"""Chargement des données de topologie, génération et demande pour ``reseau_v2``.

Sources :

- Topologie  : base de données (bus_db_03_26.csv / lines_db_03_26.csv via init-db).
- Demande    : ``harmoniq/db/demande.db`` (99 MRC québécoises, horaire).
- Génération : base de données via CRUD async + modules de production.
"""

import asyncio
import hashlib
import io
import logging
import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# Water value cost — importé depuis reservoir_tracker pour éviter la duplication de logique.
# Importé ici en module-level (pas de dépendance circulaire : reservoir_tracker n'importe pas data_loader).
from .utils.reservoir_tracker import water_value_cost as _reservoir_water_value_cost

# Pandas 3.0+ utilise ArrowStringArray par défaut → incompatible avec xarray/PyPSA 1.0.
# On force le stockage Python classique pour toutes les colonnes string afin
# d'éviter un TypeError lors de la construction du modèle linopy/xarray.
try:
    pd.options.mode.string_storage = "python"
    pd.options.future.infer_string = False  # noqa: FBT003
except AttributeError:
    pass

# Windows (cp1252) ne peut pas encoder les caractères hors BMP (ex : 🌍 U+1F30D)
# que les bibliothèques météo (open-meteo, pvlib) incluent parfois dans leurs logs.
# On reconfigure stdout/stderr en UTF-8 (errors='replace') pour éviter un
# UnicodeEncodeError fatal dans InfraParcEolienne/InfraSolaire.calculer_production().
def _ensure_utf8_streams() -> None:
    for _name in ("stdout", "stderr"):
        _s = getattr(sys, _name, None)
        if (
            _s is not None
            and hasattr(_s, "buffer")
            and getattr(_s, "encoding", "utf-8").lower() not in ("utf-8", "utf_8", "utf8")
        ):
            try:
                setattr(
                    sys,
                    _name,
                    io.TextIOWrapper(
                        _s.buffer,
                        encoding="utf-8",
                        errors="replace",
                        line_buffering=getattr(_s, "line_buffering", False),
                    ),
                )
            except Exception:
                pass

_ensure_utf8_streams()

# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------
_RESEAU_BIS_DIR = Path(__file__).parent
_HARMONIQ_DIR   = _RESEAU_BIS_DIR.parent.parent          # harmoniq/
_PROJECT_ROOT   = _HARMONIQ_DIR.parent                   # racine du projet

_DEMANDE_DB_PATH    = _HARMONIQ_DIR / "db" / "demande.db"
_MRC_BUSES_CSV      = _HARMONIQ_DIR / "db" / "CSVs" / "buses.csv"

logger = logging.getLogger("ReseauBisDataLoader")

# ---------------------------------------------------------------------------
# Cache profils de génération (parquet)
# ---------------------------------------------------------------------------
# Les profils p_max_pu (éolien, solaire, nucléaire, thermique) sont déterministes
# pour un scénario donné : même dates + même parcs → même résultat.
# On les persiste en parquet pour éviter les appels Open-Meteo répétés (~30-60s).
#
# Emplacement : ~/.cache/harmoniq/gen_profiles/profiles_<hash>.parquet
# Clé de cache : SHA-256 tronqué sur (dates, weather, pas_de_temps, noms générateurs)
# TTL : infini (données météo typiques/historiques immuables)
# Invalidation manuelle : supprimer le dossier _PROFILES_CACHE_DIR

_PROFILES_CACHE_DIR = Path.home() / ".cache" / "harmoniq" / "gen_profiles"
_EOLIEN_CACHE_DIR   = _PROFILES_CACHE_DIR / "eolien"


def _aggregate_to_resolution(
    df: pd.DataFrame,
    resolution: str,
    fill: Optional[float] = 0.0,
) -> pd.DataFrame:
    """Ré-échantillonne un DataFrame horaire vers la résolution cible.

    Centralise la règle W-MON / label="left" utilisée pour l'agrégation
    hebdomadaire des profils (p_max_pu, marginal_cost, demande, pmax_hydro).
    Garantit que tous les profils partagent la même convention d'indexation
    et évite la divergence observée quand le resample était dupliqué à
    travers le module (cf. c77c2ed).

    Args:
        df: DataFrame indexé en horaire.
        resolution: "horaire" (no-op) ou "hebdomadaire" (moyenne W-MON).
        fill: Valeur de remplissage pour ``fillna`` après resample.
            ``None`` désactive le fillna (utile pour marginal_cost où
            un NaN doit rester un NaN).

    Returns:
        DataFrame rééchantillonné. Retourne ``df`` inchangé si la
        résolution est horaire ou si le DataFrame est vide.
    """
    if df.empty or resolution == "horaire":
        return df
    if resolution == "hebdomadaire":
        out = df.resample("W-MON", label="left", closed="left").mean()
        return out.fillna(fill) if fill is not None else out
    raise ValueError(f"résolution inconnue: {resolution!r}")


def _compute_profiles_cache_key(scenario: Any, generator_names: List[str]) -> str:
    """Calcule une clé de cache courte (SHA-256 tronqué) identifiant le scénario et les générateurs.

    Args:
        scenario: Objet scénario (dates, weather, consomation, pas_de_temps).
        generator_names: Liste des noms de générateurs.

    Returns:
        Chaîne hexadécimale de 16 caractères.
    """
    key_parts = "|".join([
        str(getattr(scenario, "date_de_debut", "")),
        str(getattr(scenario, "date_de_fin",   "")),
        str(getattr(scenario, "pas_de_temps",  "")),
        str(getattr(scenario, "weather",       "")),
        str(getattr(scenario, "consomation",   "")),
        ",".join(sorted(str(n) for n in generator_names)),
    ])
    return hashlib.sha256(key_parts.encode()).hexdigest()[:16]


def _load_pmax_from_cache(cache_key: str) -> Optional[pd.DataFrame]:
    """Charge le DataFrame p_max_pu depuis le cache parquet.

    Args:
        cache_key: Clé de cache calculée par ``_compute_profiles_cache_key``.

    Returns:
        DataFrame p_max_pu, ou ``None`` si le fichier est absent ou corrompu.
    """
    cache_file = _PROFILES_CACHE_DIR / f"profiles_{cache_key}.parquet"
    if not cache_file.exists():
        return None
    try:
        df = pd.read_parquet(cache_file)
        logger.info(
            "Cache profils: HIT %s → %d générateurs, %d snapshots (évite appels Open-Meteo)",
            cache_file.name, df.shape[1], df.shape[0],
        )
        return df
    except Exception as exc:
        logger.warning("Cache profils corrompu (%s): %s → re-fetch", cache_file.name, exc)
        cache_file.unlink(missing_ok=True)
        return None


def _save_pmax_to_cache(cache_key: str, p_max_pu_df: pd.DataFrame) -> None:
    """Persiste le DataFrame p_max_pu en parquet.

    Args:
        cache_key: Clé de cache calculée par ``_compute_profiles_cache_key``.
        p_max_pu_df: DataFrame à persister (index = snapshots, colonnes = générateurs).
    """
    try:
        _PROFILES_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file = _PROFILES_CACHE_DIR / f"profiles_{cache_key}.parquet"
        p_max_pu_df.to_parquet(cache_file)
        logger.info(
            "Cache profils: sauvegardé → %s (%d générateurs, %d snapshots, %.1f KB)",
            cache_file.name, p_max_pu_df.shape[1], p_max_pu_df.shape[0],
            cache_file.stat().st_size / 1024,
        )
    except Exception as exc:
        logger.warning("Cache profils: échec sauvegarde: %s", exc)


# ---------------------------------------------------------------------------
# Cache éolien par parc (indépendant du cache global)
# ---------------------------------------------------------------------------
# Clé par parc : SHA-256(dates + weather + parc.id) → ne dépend PAS des autres
# générateurs. Ajouter un barrage fictif n'invalide plus les 43 profils ERA5.

def _compute_eolien_cache_key(scenario: Any, parc_id: int) -> str:
    key = "|".join([
        str(getattr(scenario, "date_de_debut", "")),
        str(getattr(scenario, "date_de_fin",   "")),
        str(getattr(scenario, "pas_de_temps",  "")),
        str(getattr(scenario, "weather",       "")),
        str(parc_id),
    ])
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _load_eolien_from_cache(key: str) -> Optional[pd.Series]:
    f = _EOLIEN_CACHE_DIR / f"eol_{key}.parquet"
    if not f.exists():
        return None
    try:
        return pd.read_parquet(f).iloc[:, 0]
    except Exception:
        f.unlink(missing_ok=True)
        return None


def _save_eolien_to_cache(key: str, series: pd.Series) -> None:
    try:
        _EOLIEN_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        series.to_frame("p_max_pu").to_parquet(_EOLIEN_CACHE_DIR / f"eol_{key}.parquet")
    except Exception as exc:
        logger.warning("Cache éolien: échec sauvegarde %s: %s", key, exc)


# ---------------------------------------------------------------------------
# Profil saisonnier fil de l'eau (pas d'appel API — calcul instantané)
# ---------------------------------------------------------------------------
# Calqué sur les débits réels (apport_naturel CSV) :
# Crue printanière (avril-juin) → CF élevé → surplus export.
# Étiage hivernal (déc-fév) → CF bas → import aux pointes.
# Moyenne annuelle ≈ 0.50 → ~70 TWh total fil de l'eau sur 15.9 GW installé.
#                      Jan   Fév   Mar   Avr   Mai   Jun   Jul   Aoû   Sep   Oct   Nov   Déc
_FIL_MONTHLY_CF = [0.4, 0.32, 0.37, 0.68, 0.75, 0.7, 0.6, 0.6, 0.6, 0.5, 0.5, 0.4]

# ---------------------------------------------------------------------------
# Prime hivernale sur la valeur de l'eau des réservoirs ($/MWh)
# ---------------------------------------------------------------------------
# En hiver, HQ valorise ses réservoirs au-dessus du coût marginal pur :
#   1. Risque de vague de froid → réserve stratégique (Régie D-2023-109)
#   2. Apports naturels au minimum (rivières gelées, ratio 4.8× vs avril)
#   3. Demande au pic annuel (chauffage + éclairage, 36 000+ MW)
# La prime rend l'import compétitif en décembre ET janvier en relevant le coût
# effectif du réservoir au-dessus du prix d'import hivernal (~16 $/MWh).
#
# Calibration — tendance 10 ans IESO (2016-2022, hors anomalie 2023-2025) :
#   - QC importe ~2,200 GWh/an d'Ontario seul (surplus nucléaire off-peak)
#   - Total QC toutes interties : ~3-4 TWh imports, concentrés hiver
#   - QC reste exportateur net global (~33-40 TWh export)
#   - Données horaires HQ (export_data CSV 2024-2026) confirment que col3
#     (Ontario) est 86% négatif (import) même en mois d'été.
# Sources : IESO Annual Imports/Exports by Jurisdiction, HQ Rapport Annuel,
#           IESO Ontario-Quebec Interconnection Capability Report (2017).
#                                Jan  Fév  Mar  Avr  Mai  Jun  Jul  Aoû  Sep  Oct  Nov  Déc
# Prime relevée pour que le water value hivernal dépasse le prix import Ontario (15 $/MWh).
# À fill=70% : base=6.5 $/MWh + prime → 18.5 $/MWh (jan) > Ontario 15 $/MWh.
# → LP préfère importer en pointe hivernale plutôt que dépléter les réservoirs.
_WINTER_RESERVOIR_PREMIUM = [12.0, 12.0, 3.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 5.0, 12.0]


def _apply_winter_premium(costs: np.ndarray, snapshots: pd.DatetimeIndex) -> np.ndarray:
    """Ajoute la prime saisonnière au coût marginal des réservoirs.

    En hiver (déc-jan-fév), la prime élève le coût de l'eau pour refléter
    la valeur stratégique du stockage, rendant l'import compétitif aux pointes.

    Args:
        costs: Tableau de coûts de base ($/MWh), un par snapshot.
        snapshots: Index temporel aligné sur ``costs``.

    Returns:
        Tableau de coûts ajustés ($/MWh).
    """
    premium = np.array([_WINTER_RESERVOIR_PREMIUM[ts.month - 1] for ts in snapshots])
    return costs + premium


def _compute_initial_reservoir_pmax(
    initial_fills: Dict[str, float],
    reservoir_gen_names: List[str],
    snapshots: pd.DatetimeIndex,
    ratio_dispo_map: Dict[str, float] | None = None,
    regulation_map: Dict[str, str] | None = None,
) -> pd.DataFrame:
    """Calcule la contrainte p_max_pu initiale des réservoirs (statique pour le premier chunk).

    Interpolation fill → p_max_pu avant maintenance, différenciée par type de régulation :

    **Annuel** (seuil critique 40%) :
    - fill ≥ 70 % → 0.95 (libre)
    - fill = 55 % → 0.50 (prudence)
    - fill ≤ 40 % → 0.15 (réserve stratégique — force l'import)

    **Pluriannuel** (seuil critique 80%) :
    - fill ≥ 93 % → 0.95 (libre)
    - fill = 87 % → 0.50 (prudence)
    - fill ≤ 80 % → 0.15 (réserve stratégique — force l'import)

    Le résultat est multiplié par ``ratio_dispo`` (turbines disponibles / total).
    L'optimiseur met à jour cette contrainte chunk par chunk via le feed-forward hydraulique.

    Args:
        initial_fills: Dict ``{nom_barrage: fraction [0-1]}``.
        reservoir_gen_names: Noms des générateurs réservoir dans le réseau PyPSA.
        snapshots: Index temporel.
        ratio_dispo_map: Dict ``{nom_barrage: ratio}`` de disponibilité des turbines.
        regulation_map: Dict ``{nom_barrage: "Annuel"|"Pluriannuel"}``.

    Returns:
        DataFrame ``p_max_pu`` (index = snapshots, colonnes = noms de générateurs).
    """
    if ratio_dispo_map is None:
        ratio_dispo_map = {}
    if regulation_map is None:
        regulation_map = {}
    reservoir_pmax = pd.DataFrame(index=snapshots)
    for gname in reservoir_gen_names:
        fill = initial_fills.get(gname, initial_fills.get("_global", 0.70))
        reg = regulation_map.get(gname, "Pluriannuel").strip().lower()
        xp = [0.40, 0.55, 0.70] if reg == "annuel" else [0.80, 0.87, 0.93]
        pmax_val = float(np.interp(fill, xp, [0.15, 0.50, 0.95]))
        pmax_val = float(np.clip(pmax_val, 0.0, 0.95))
        ratio = float(ratio_dispo_map.get(gname, 1.0))
        pmax_val = float(np.clip(pmax_val * ratio, 0.0, ratio))
        reservoir_pmax[gname] = pmax_val
        logger.debug(
            "Réserve stratégique %s (%s) : fill=%.0f%% ratio_dispo=%.2f → p_max_pu=%.2f",
            gname, reg, fill * 100, ratio, pmax_val,
        )
    return reservoir_pmax


def _apply_hydro_fil_seasonal_profile(
    p_max_pu: pd.DataFrame,
    generators_df: pd.DataFrame,
    snapshots: pd.DatetimeIndex,
) -> pd.DataFrame:
    """Applique le profil saisonnier mensuel aux générateurs hydro fil de l'eau.

    Le profil est recalculé à chaque run car il dépend des snapshots (non caché).

    Args:
        p_max_pu: DataFrame de disponibilité à mettre à jour.
        generators_df: Table statique des générateurs.
        snapshots: Index temporel.

    Returns:
        DataFrame ``p_max_pu`` mis à jour.
    """
    fil_names = [
        gen.get("name") for _, gen in generators_df.iterrows()
        if str(gen.get("carrier", "")) == "hydro_fil" and gen.get("name")
    ]
    if not fil_names:
        return p_max_pu
    seasonal = pd.Series(
        [_FIL_MONTHLY_CF[ts.month - 1] for ts in snapshots],
        index=snapshots,
    )
    for name in fil_names:
        if name in p_max_pu.columns:
            p_max_pu[name] = seasonal
        # Si la colonne n'existe pas encore (nouveau générateur), on l'ajoute
        else:
            p_max_pu[name] = seasonal
    return p_max_pu


# ---------------------------------------------------------------------------
# Worker thread pour fetch éolien parallèle
# ---------------------------------------------------------------------------

def _fetch_one_eolien_profile(
    args: Tuple[Any, Any, pd.DatetimeIndex]
) -> Tuple[str, Optional[pd.Series]]:
    """Calcule le profil p_max_pu d'un parc éolien dans un thread dédié.

    Appelé via ``ThreadPoolExecutor`` ; chaque parc est traité en parallèle.
    Chaque thread crée sa propre instance ``InfraParcEolienne`` (pas d'état partagé).

    Args:
        args: Tuple ``(parc, scenario, snapshots)``.

    Returns:
        Tuple ``(nom_parc, Series p_max_pu alignée sur snapshots)``, ou
        ``(nom, None)`` en cas d'échec.
    """
    parc, scenario, snapshots = args
    if InfraParcEolienne is None:
        return parc.nom, None

    # Cache par parc : évite l'appel ERA5 si le profil est déjà calculé.
    # Indépendant du cache global → un nouveau barrage fictif ne l'invalide pas.
    # Les parcs créés par l'utilisateur n'ont pas de .id DB → fallback sur .nom.
    parc_key = getattr(parc, "id", None) or parc.nom
    eol_key = _compute_eolien_cache_key(scenario, parc_key)
    cached = _load_eolien_from_cache(eol_key)
    if cached is not None:
        logger.debug("Cache éolien: HIT %s (parc=%s)", eol_key[:8], parc.nom)
        return parc.nom, cached.reindex(snapshots).fillna(0.25).clip(0.0, 1.0)

    try:
        infra = InfraParcEolienne(parc)
        infra.charger_scenario(scenario)
        prod = infra.calculer_production()
        if prod is not None and "puissance" in prod.columns:
            p_nom = float(parc.puissance_nominal) * float(parc.nombre_eoliennes)
            if p_nom > 0:
                series = pd.Series(
                    prod["puissance"].values,
                    index=pd.to_datetime(prod["tempsdate"]),
                )
                aligned = series.reindex(snapshots).fillna(0.0)
                profile = (aligned / p_nom).clip(0.0, 1.0).fillna(0.25)
                _save_eolien_to_cache(eol_key, profile)
                return parc.nom, profile
    except Exception as exc:
        logger.warning("Echec p_max_pu eolien %s: %s", parc.nom, exc)
    return parc.nom, None

try:
    from harmoniq.db.CRUD import (
        read_all_bus_async,
        read_all_data,
        read_all_line_async,
        read_all_line_type_async,
        read_multiple_by_id,
    )
    from harmoniq.db.demande import read_demande_data
    from harmoniq.db.schemas import EolienneParc, Hydro, Nucleaire, Scenario, Solaire, Thermique

    DB_INTEGRATION_AVAILABLE = True
except Exception:
    DB_INTEGRATION_AVAILABLE = False

try:
    from harmoniq.modules.eolienne import InfraParcEolienne
except Exception as _e:
    logger.warning("Module eolien indisponible (%s) — fallback p_max_pu constant", _e)
    InfraParcEolienne = None  # type: ignore[assignment,misc]

try:
    from harmoniq.modules.solaire import InfraSolaire
except Exception as _e:
    logger.warning("Module solaire indisponible (%s) — fallback p_max_pu constant", _e)
    InfraSolaire = None  # type: ignore[assignment,misc]

try:
    from harmoniq.modules.nucleaire import InfraNucleaire
except Exception as _e:
    logger.warning("Module nucleaire indisponible (%s) — fallback p_max_pu constant", _e)
    InfraNucleaire = None  # type: ignore[assignment,misc]

try:
    from harmoniq.modules.hydro import InfraHydro
except Exception as _e:
    logger.warning("Module hydro indisponible (%s) — fallback p_max_pu constant", _e)
    InfraHydro = None  # type: ignore[assignment,misc]

try:
    from harmoniq.modules.thermique import InfraThermique
except Exception as _e:
    logger.warning("Module thermique indisponible (%s) — fallback p_max_pu constant", _e)
    InfraThermique = None  # type: ignore[assignment,misc]

PRODUCTION_MODULES_AVAILABLE = any(
    m is not None
    for m in [InfraParcEolienne, InfraSolaire, InfraNucleaire, InfraHydro, InfraThermique]
)


def get_database_fetch_plan() -> Dict[str, Any]:
    """Retourne un plan documentaire des sources DB utilisées par le chargeur."""
    return {
        "topology": {
            "bus": "read_all_bus_async",
            "line": "read_all_line_async",
            "line_type": "read_all_line_type_async",
        },
        "generation": {
            "eolien": "read_multiple_by_id/read_all_data(EolienneParc)",
            "solaire": "read_multiple_by_id/read_all_data(Solaire)",
            "hydro": "read_multiple_by_id/read_all_data(Hydro)",
            "thermique": "read_multiple_by_id/read_all_data(Thermique)",
            "nucleaire": "read_multiple_by_id/read_all_data(Nucleaire)",
        },
        "demand": {
            "source": "read_demande_data(Scenario, CUID=1)",
            "note": "distribution par load a faire dans une etape ulterieure",
        },
    }


def get_loader_todo_list() -> List[str]:
    """Retourne la liste des tâches à réaliser dans le chargeur de données."""
    return [
        "Brancher la lecture DB des bus/lignes/line_types (CRUD async existants).",
        "Mapper les IDs d'infrastructures depuis ListeInfrastructures (dont central_nucleaire).",
        "[DONE] Connecter les modules de production (eolien, solaire, nucleaire) via _generate_timeseries.",
        "[DONE] Generer `p_max_pu` et `marginal_cost` aligns sur les snapshots du scenario.",
        "Brancher la demande via read_demande_data puis repartir par loads.",
        "[DONE] Aligner les p_max_pu hydro_fil sur InfraHydro.calculer_production() (debits reels CSV).",
        "Ajouter une strategie cache coherent (optionnel, apres stabilisation).",
    ]


class NetworkDataLoaderBis:
    """Façade de chargement des données réseau pour ``reseau_v2``."""

    def __init__(self) -> None:
        self.eolienne_ids = None
        self.solaire_ids = None
        self.hydro_ids = None
        self.thermique_ids = None
        self.nucleaire_ids = None

    def set_infrastructure_ids(self, liste_infra: Any) -> None:
        """Extrait et stocke les IDs d'infrastructure depuis un groupe d'infras.

        Args:
            liste_infra: Objet avec les champs ``parc_eoliens``, ``parc_solaires``,
                ``central_hydroelectriques``, ``central_thermique``, ``central_nucleaire``.
        """
        self.eolienne_ids = _parse_ids(getattr(liste_infra, "parc_eoliens", None))
        self.solaire_ids = _parse_ids(getattr(liste_infra, "parc_solaires", None))
        self.hydro_ids = _parse_ids(getattr(liste_infra, "central_hydroelectriques", None))
        self.thermique_ids = _parse_ids(getattr(liste_infra, "central_thermique", None))
        self.nucleaire_ids = _parse_ids(getattr(liste_infra, "central_nucleaire", None))

    def load_topology_from_db(self, db: Any) -> Dict[str, pd.DataFrame]:
        """Charge la topologie depuis la DB (bus_db_03_26.csv / lines_db_03_26.csv via init-db).

        Les bus conservent leurs identifiants internes ("Bus1", "Bus2", …) comme nom PyPSA.
        Utiliser display_name ("Radisson", "La Grande-3", …) comme nom de bus causerait
        77 collisions avec les noms de générateurs hydro, ce qui brise le LOPF PyPSA 1.x
        (xarray CoordinateValidationError dans define_nodal_balance_constraints).

        La topologie 03_26 positionne chaque bus aux coordonnées exactes de sa centrale :
        la recherche par proximité dans _fetch_generators_from_db trouve naturellement
        "Bus2" pour La Grande-3, "Bus1" pour Radisson, etc., sans besoin de mapping nominal.

        display_name est conservé comme colonne auxiliaire dans buses_df pour la visu.
        Les lignes utilisent déjà les IDs internes en DB (bus0="Bus1") — aucune traduction.
        """
        buses_df = pd.DataFrame(columns=["name", "v_nom", "type", "x", "y", "control"])
        lines_df = pd.DataFrame(columns=["name", "bus0", "bus1", "type", "length", "s_nom"])
        line_types_df = _make_line_types_df()

        if not DB_INTEGRATION_AVAILABLE or db is None:
            logger.warning("DB non disponible — topologie vide.")
            return {"buses": buses_df, "lines": lines_df, "line_types": line_types_df}

        buses_raw = _run_async(read_all_bus_async(db))
        lines_raw = _run_async(read_all_line_async(db))
        line_types_raw = _run_async(read_all_line_type_async(db))

        if buses_raw is not None:
            raw_df = _records_to_df(buses_raw)
            # Garder name = identifiant interne "Bus1" comme clé PyPSA.
            # display_name = nom géographique conservé comme attribut auxiliaire.
            # Normaliser les enums SQLAlchemy : "BusType.conso" → "conso", "BusControlType.PQ" → "PQ".
            for col in ("type", "control"):
                if col in raw_df.columns:
                    raw_df[col] = raw_df[col].astype(str).str.split(".").str[-1]
            # bus_db_03_26.csv stocke x=longitude, y=latitude.
            # La convention interne du data_loader est x=latitude, y=longitude (héritage xlsx).
            # On échange x ↔ y ici pour homogénéité avec _find_bus_for_generator et
            # _build_mrc_to_conso_mapping qui assument tous deux x=lat, y=lon.
            if "x" in raw_df.columns and "y" in raw_df.columns:
                raw_df = raw_df.rename(columns={"x": "y", "y": "x"})
            buses_df = _select_columns(raw_df, ["name", "v_nom", "type", "x", "y", "control", "display_name"])

        if lines_raw is not None:
            # bus0/bus1 sont déjà en identifiants internes en DB — aucune traduction.
            lines_df = _select_columns(
                _records_to_df(lines_raw),
                ["name", "bus0", "bus1", "type", "length", "s_nom"],
            )

        if line_types_raw is not None:
            line_types_df = _select_columns(
                _records_to_df(line_types_raw), ["name", "f_nom", "r_per_length", "x_per_length"]
            )

        logger.info(
            "Topologie chargée depuis DB : %d bus, %d lignes, %d types.",
            len(buses_df), len(lines_df), len(line_types_df),
        )
        return {"buses": buses_df, "lines": lines_df, "line_types": line_types_df}

    def load_generation_profiles(
        self,
        scenario: Any,
        liste_infra: Any,
        db: Any,
        resolution: str = "horaire",
        buses_df: Optional[pd.DataFrame] = None,
    ) -> Dict[str, pd.DataFrame]:
        """Charge les métadonnées et séries temporelles de génération.

        Args:
            scenario: Objet scénario (dates, weather, pas_de_temps).
            liste_infra: Groupe d'infrastructures.
            db: Session SQLAlchemy.
            resolution: ``"horaire"`` (8 760 snapshots) ou ``"hebdomadaire"`` (52 moyennes).
            buses_df: DataFrame de topologie déjà chargé (évite un double aller-retour DB).

        Returns:
            Dict avec les clés ``generators`` (DataFrame statique), ``p_max_pu``
            et ``marginal_cost`` (DataFrames index = snapshots).
        """
        self.set_infrastructure_ids(liste_infra)
        # Toujours charger à la résolution horaire (pour le cache parquet et les modules de production)
        snapshots = _build_snapshots_from_scenario(scenario)

        generators = pd.DataFrame(
            columns=[
                "name",
                "bus",
                "carrier",
                "p_nom",
                "p_nom_extendable",
                "p_nom_min",
                "p_nom_max",
                "marginal_cost",
            ]
        )

        if DB_INTEGRATION_AVAILABLE and db is not None:
            # Utiliser buses_df fourni pour éviter un double chargement de la topologie xlsx.
            # Si absent, charger maintenant (cas standalone sans service.py).
            if buses_df is None or buses_df.empty:
                topology = self.load_topology_from_db(db)
                buses_df = topology.get("buses", pd.DataFrame())

            gen_rows: list[dict[str, Any]] = []
            # User infras insérées en premier : leurs valeurs priment sur la DB
            # lors du dedup (utile quand l'utilisateur modifie la capacité d'un
            # barrage fictif déjà présent en base).
            gen_rows.extend(_generators_from_user_infras(liste_infra, buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, EolienneParc, self.eolienne_ids, "eolien", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Solaire, self.solaire_ids, "solaire", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Hydro, self.hydro_ids, "hydro", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Thermique, self.thermique_ids, "thermique", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Nucleaire, self.nucleaire_ids, "nucleaire", buses_df))

            # Dédupliquer par nom : garde la première occurrence (user prime sur DB).
            _seen: set[str] = set()
            _deduped: list[dict] = []
            _dropped: list[str] = []
            for _r in gen_rows:
                _n = _r.get("name")
                if _n not in _seen:
                    _seen.add(_n)
                    _deduped.append(_r)
                else:
                    _dropped.append(_n)
            if _dropped:
                logger.debug(
                    "Generators dédupliqués (user prime sur DB): %s", _dropped
                )
            gen_rows = _deduped

            if gen_rows:
                generators = pd.DataFrame(gen_rows)

        p_max_pu, marginal_cost = self._generate_timeseries(
            db=db,
            scenario=scenario,
            snapshots=snapshots,
            generators_df=generators,
            resolution=resolution,
            liste_infra=liste_infra,
        )

        return {
            "generators": generators,
            "p_max_pu": p_max_pu,
            "marginal_cost": marginal_cost,
        }

    def _generate_timeseries(
        self,
        db: Any,
        scenario: Any,
        snapshots: pd.DatetimeIndex,
        generators_df: pd.DataFrame,
        resolution: str = "horaire",
        liste_infra: Any = None,
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Génère p_max_pu et marginal_cost pour tous les générateurs.

        Séquence :

        1. ``InfraParcEolienne`` / ``InfraSolaire`` / ``InfraNucleaire`` pour les profils réels.
        2. Profils saisonniers ou constants pour hydro/thermique.
        3. Fallback p_max_pu = 1.0 pour tout générateur non couvert.

        Args:
            db: Session SQLAlchemy.
            scenario: Objet scénario.
            snapshots: Index temporel horaire.
            generators_df: Table statique des générateurs.
            resolution: ``"horaire"`` ou ``"hebdomadaire"``.

        Returns:
            Tuple ``(p_max_pu, marginal_cost)`` — deux DataFrames index = snapshots.
        """
        MARGINAL_COSTS = {
            # Sources non pilotables : coût 0 $/MWh → dispatché en priorité absolue.
            # L'optimizer prend tout ce qu'elles produisent et exporte le surplus
            # via les interconnexions (Ontario/NY/NE en été).
            # Curtailment seulement si exports saturés ET réseau congestionné.
            "eolien":          0.0,
            "solaire":         0.0,
            "hydro_fil":       0.0,   # must-run, eau non stockable — coût marginal nul
            # Sources pilotables : coût croissant → mérite order naturel.
            # hydro_reservoir : coût dynamique (valeur de l'eau) remplace ce fallback ci-dessous.
            "hydro_reservoir": 5.0,
            "thermique":       30.0,
            "nucleaire":       0.2,
        }

        # Accumulateurs dict → pd.concat en fin de méthode (évite PerformanceWarning
        # "DataFrame is highly fragmented" causé par 75+ insertions colonne par colonne).
        p_max_pu_cols: Dict[str, Any] = {}
        marginal_cost_cols: Dict[str, Any] = {}

        if generators_df.empty:
            return pd.DataFrame(index=snapshots), pd.DataFrame(index=snapshots)

        gen_names = set(generators_df["name"].dropna())

        # ------------------------------------------------------------------
        # Cache parquet : vérification avant tout appel Open-Meteo
        # ------------------------------------------------------------------
        # Les profils p_max_pu sont déterministes pour un même scénario.
        # On cache le DataFrame complet → évite ~30-60s d'appels API à chaque run.
        # Le marginal_cost n'est PAS caché (coût dynamique hydro_reservoir selon remplissage).
        _cache_key = _compute_profiles_cache_key(scenario, list(gen_names))
        _cached_pmax = _load_pmax_from_cache(_cache_key)
        if _cached_pmax is not None:
            # Cache hit : reconstruire marginal_cost (rapide) et retourner immédiatement
            for _, gen in generators_df.iterrows():
                name = gen.get("name")
                carrier = str(gen.get("carrier", ""))
                if name:
                    marginal_cost_cols[name] = MARGINAL_COSTS.get(carrier, 10.0)
            # --- Water value initiale : coût basé sur le niveau initial du réservoir ---
            # Le feed-forward dans l'optimiseur met à jour le coût chunk par chunk.
            reservoir_gen_names = [
                gen.get("name") for _, gen in generators_df.iterrows()
                if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
            ]
            _ratio_dispo_map = {
                gen.get("name"): float(gen.get("ratio_dispo", 1.0))
                for _, gen in generators_df.iterrows()
                if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
            }
            _regulation_map = {
                gen.get("name"): str(gen.get("regulation", "Pluriannuel"))
                for _, gen in generators_df.iterrows()
                if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
            }
            reservoir_pmax_df = None
            if reservoir_gen_names:
                initial_fills = _get_initial_reservoir_fill(scenario)
                reservoir_pmax_df = _compute_initial_reservoir_pmax(initial_fills, reservoir_gen_names, snapshots, _ratio_dispo_map, _regulation_map)
                for gname in reservoir_gen_names:
                    fill = initial_fills.get(gname, initial_fills.get("_global", 0.70))
                    regulation = _regulation_map.get(gname, "Pluriannuel")
                    base_cost = float(_reservoir_water_value_cost(np.array([fill]), regulation)[0])
                    costs = _apply_winter_premium(np.full(len(snapshots), base_cost), snapshots)
                    marginal_cost_cols[gname] = pd.Series(costs, index=snapshots)
                    logger.info(
                        "Barrage %s (%s) : fill initial=%.0f%% → coût de base %.1f $/MWh (incl. prime hiver)",
                        gname, regulation, fill * 100, base_cost,
                    )
            mc_df = pd.DataFrame(
                {n: [v] * len(snapshots) if not isinstance(v, pd.Series) else v
                 for n, v in marginal_cost_cols.items()},
                index=snapshots,
            )
            # Réaligner le cache sur les snapshots horaires courants (sécurité si période ≠)
            pmax_aligned = _cached_pmax.reindex(index=snapshots, fill_value=1.0)
            # --- Toujours recalculer hydro_fil p_max_pu (profil saisonnier, pas d'API) ---
            pmax_aligned = _apply_hydro_fil_seasonal_profile(pmax_aligned, generators_df, snapshots)
            # --- Appliquer la contrainte de réserve stratégique sur les réservoirs ---
            if reservoir_pmax_df is not None:
                for col in reservoir_pmax_df.columns:
                    if col in pmax_aligned.columns:
                        pmax_aligned[col] = reservoir_pmax_df[col]
            # Rééchantillonner à la résolution cible si besoin
            pmax_aligned = _aggregate_to_resolution(pmax_aligned, resolution)
            mc_df = _aggregate_to_resolution(mc_df, resolution, fill=None)
            return pmax_aligned, mc_df

        # Coûts marginaux initiaux fixes par carrier
        for _, gen in generators_df.iterrows():
            name = gen.get("name")
            carrier = str(gen.get("carrier", ""))
            if name:
                marginal_cost_cols[name] = MARGINAL_COSTS.get(carrier, 10.0)

        # --- Water value initiale : coût basé sur le niveau initial du réservoir ---
        # Pas de trajectoire pré-OPF fictive : le coût de départ est calculé depuis
        # le fill initial uniquement. L'optimiseur met à jour chunk par chunk via le
        # feed-forward hydraulique (ReservoirDamFeed + _update_reservoir_costs_and_pmax).
        reservoir_gen_names = [
            gen.get("name") for _, gen in generators_df.iterrows()
            if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
        ]
        _ratio_dispo_map = {
            gen.get("name"): float(gen.get("ratio_dispo", 1.0))
            for _, gen in generators_df.iterrows()
            if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
        }
        _regulation_map = {
            gen.get("name"): str(gen.get("regulation", "Pluriannuel"))
            for _, gen in generators_df.iterrows()
            if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
        }
        _reservoir_pmax_for_later = None
        if reservoir_gen_names:
            initial_fills = _get_initial_reservoir_fill(scenario)
            _reservoir_pmax_for_later = _compute_initial_reservoir_pmax(initial_fills, reservoir_gen_names, snapshots, _ratio_dispo_map, _regulation_map)
            for gname in reservoir_gen_names:
                fill = initial_fills.get(gname, initial_fills.get("_global", 0.70))
                regulation = _regulation_map.get(gname, "Pluriannuel")
                base_cost = float(_reservoir_water_value_cost(np.array([fill]), regulation)[0])
                costs = _apply_winter_premium(np.full(len(snapshots), base_cost), snapshots)
                marginal_cost_cols[gname] = pd.Series(costs, index=snapshots)
                logger.info(
                    "Barrage %s (%s) : fill initial=%.0f%% → coût de base %.1f $/MWh (incl. prime hiver)",
                    gname, regulation, fill * 100, base_cost,
                )

        # --- Eolien (parallèle via ThreadPoolExecutor) ---
        # InfraParcEolienne.charger_scenario() est async mais appelle WeatherHelper.load()
        # qui est synchrone en dessous (requests_cache + openmeteo_requests HTTP).
        # asyncio.gather() ne parallélise pas le code synchrone → on utilise des threads.
        # Chaque thread crée sa propre instance InfraParcEolienne + son event loop isolé.
        # max_workers=8 : limité pour ne pas surcharger l'API Open-Meteo (rate limiting).
        if PRODUCTION_MODULES_AVAILABLE and DB_INTEGRATION_AVAILABLE:
            try:
                eoliennes = (
                    _run_async(read_multiple_by_id(db, EolienneParc, self.eolienne_ids))
                    if self.eolienne_ids
                    else _run_async(read_all_data(db, EolienneParc))
                )
                # Inclure aussi les parcs éoliens créés par l'utilisateur (Pydantic)
                # afin qu'ils obtiennent un profil ERA5 réaliste (p_max_pu variable),
                # et non le fallback constant 1.0 qui surcomptait leur production.
                user_eoliens = [
                    infra for infra in (getattr(liste_infra, "parc_eoliens", None) or [])
                    if getattr(infra, "is_user_created", False)
                ]
                valid_parcs = [p for p in (eoliennes or []) if p.nom in gen_names]
                valid_parcs += [p for p in user_eoliens if p.nom in gen_names]
                if valid_parcs:
                    args_list = [(parc, scenario, snapshots) for parc in valid_parcs]
                    n_workers = min(8, len(valid_parcs))
                    logger.info(
                        "Fetch éolien parallèle : %d parcs, %d workers",
                        len(valid_parcs), n_workers,
                    )
                    with ThreadPoolExecutor(max_workers=n_workers) as executor:
                        futures = {
                            executor.submit(_fetch_one_eolien_profile, args): args[0].nom
                            for args in args_list
                        }
                        for future in as_completed(futures):
                            nom, profile = future.result()
                            if profile is not None:
                                p_max_pu_cols[nom] = profile
            except Exception as exc:
                logger.warning("Echec fetch eoliennes pour timeseries: %s", exc)

        # --- Solaire (sync charger_scenario) ---
        if PRODUCTION_MODULES_AVAILABLE and DB_INTEGRATION_AVAILABLE:
            try:
                solaires = (
                    _run_async(read_multiple_by_id(db, Solaire, self.solaire_ids))
                    if self.solaire_ids
                    else _run_async(read_all_data(db, Solaire))
                )
                # Inclure aussi les parcs solaires créés par l'utilisateur (Pydantic)
                # afin qu'ils obtiennent un profil PVGIS réaliste (p_max_pu variable),
                # et non le fallback constant 1.0 qui surcomptait leur production.
                user_solaires = [
                    infra for infra in (getattr(liste_infra, "parc_solaires", None) or [])
                    if getattr(infra, "is_user_created", False)
                ]
                for parc in list(solaires or []) + user_solaires:
                    nom = parc.nom
                    if nom not in gen_names:
                        continue
                    try:
                        infra = InfraSolaire(parc)
                        infra.charger_scenario(scenario)
                        prod = infra.calculer_production()
                        # InfraSolaire.calculer_production() retourne :
                        #   - colonne "production" en kW (puissance_nominal_kW * nb_panneaux * cos_profile)
                        #   - ou "production_horaire_wh" selon la version du module.
                        # La puissance crête réelle du parc = puissance_nominal_kW * nombre_panneau (en kW).
                        # p_max_pu = production_kW / peak_kW → capacity factor [0,1].
                        prod_col = None
                        if prod is not None:
                            for col_name in ("production_horaire_wh", "production"):
                                if col_name in prod.columns:
                                    prod_col = col_name
                                    break
                        if prod_col is not None:
                            prod_ts = prod.set_index("date") if "date" in prod.columns else prod
                            series = prod_ts[prod_col]
                            # Normaliser en p.u. par rapport au p_nom du parc (comme pour l'éolien).
                            # p_nom_kw = puissance_nominal (kW/panneau) × nombre_panneau.
                            # Si la colonne est "production_horaire_wh" (Wh/h = W moyen),
                            # on divise par 1000 pour passer en kW avant normalisation.
                            p_nom_kw = float(parc.puissance_nominal) * float(parc.nombre_panneau)
                            if prod_col == "production_horaire_wh":
                                series_kw = series / 1000.0  # W → kW
                            else:
                                series_kw = series  # déjà en kW
                            if p_nom_kw > 0:
                                cf_hourly = (series_kw / p_nom_kw).clip(0.0, 1.0).fillna(0.0)
                                # Agréger en moyenne hebdomadaire si snapshots sont hebdo
                                snap_freq = pd.infer_freq(snapshots) if len(snapshots) > 2 else None
                                if snap_freq and "W" in str(snap_freq):
                                    cf_weekly = cf_hourly.resample("W-MON", label="left").mean()
                                    cf_aligned = cf_weekly.reindex(snapshots, method="nearest",
                                                                   tolerance=pd.Timedelta("7D")).fillna(0.0)
                                else:
                                    cf_aligned = cf_hourly.reindex(snapshots, method="nearest",
                                                                   tolerance=pd.Timedelta("1h")).fillna(0.0)
                                p_max_pu_cols[nom] = cf_aligned
                                logger.info("Profil solaire %s : CF moyen=%.2f (p_nom=%.0f kW, module OK)",
                                            nom, cf_aligned.mean(), p_nom_kw)
                    except Exception as exc:
                        logger.warning("Echec p_max_pu solaire %s: %s", parc.nom, exc)
            except Exception as exc:
                logger.warning("Echec fetch solaires pour timeseries: %s", exc)

        # --- Nucleaire (sync charger_scenario) ---
        if PRODUCTION_MODULES_AVAILABLE and DB_INTEGRATION_AVAILABLE:
            try:
                nucleaires = (
                    _run_async(read_multiple_by_id(db, Nucleaire, self.nucleaire_ids))
                    if self.nucleaire_ids
                    else _run_async(read_all_data(db, Nucleaire))
                )
                for centrale in (nucleaires or []):
                    nom = centrale.centrale_nucleaire_nom
                    if nom not in gen_names:
                        continue
                    try:
                        infra = InfraNucleaire(centrale)
                        infra.charger_scenario(scenario)
                        prod = infra.calculer_production()
                        if prod is not None and "production_horaire_wh" in prod.columns:
                            p_nom = float(centrale.puissance_nominal)
                            if p_nom > 0:
                                series = pd.Series(prod["production_horaire_wh"].values, index=prod.index)
                                aligned = series.reindex(snapshots).fillna(0.0)
                                p_max_pu_cols[nom] = (aligned / p_nom).clip(0.0, 1.0).fillna(0.85)
                    except Exception as exc:
                        logger.warning("Echec p_max_pu nucleaire %s: %s", centrale.centrale_nucleaire_nom, exc)
            except Exception as exc:
                logger.warning("Echec fetch nucleaires pour timeseries: %s", exc)

        # --- Hydro fil de l'eau (InfraHydro, sync) ---
        if PRODUCTION_MODULES_AVAILABLE and DB_INTEGRATION_AVAILABLE:
            try:
                hydros = (
                    _run_async(read_multiple_by_id(db, Hydro, self.hydro_ids))
                    if self.hydro_ids
                    else _run_async(read_all_data(db, Hydro))
                )
                for barrage in (hydros or []):
                    if str(getattr(barrage, "type_barrage", "")).strip() != "Fil de l'eau":
                        continue
                    nom = barrage.nom
                    if nom not in gen_names:
                        continue
                    try:
                        infra = InfraHydro(barrage)
                        infra.charger_scenario(scenario)
                        prod = infra.calculer_production()
                        if prod is not None and not prod.empty:
                            p_nom = float(barrage.puissance_nominal)
                            if p_nom > 0:
                                aligned = prod.reindex(snapshots).fillna(0.0)
                                p_max_pu_cols[nom] = (aligned / p_nom).clip(0.0, 1.0).fillna(0.6)
                    except Exception as exc:
                        logger.warning("Echec p_max_pu hydro_fil %s: %s", barrage.nom, exc)
            except Exception as exc:
                logger.warning("Echec fetch hydro pour timeseries: %s", exc)

        # --- Thermique (sync charger_scenario) ---
        if PRODUCTION_MODULES_AVAILABLE and DB_INTEGRATION_AVAILABLE:
            try:
                thermiques = (
                    _run_async(read_multiple_by_id(db, Thermique, self.thermique_ids))
                    if self.thermique_ids
                    else _run_async(read_all_data(db, Thermique))
                )
                for centrale in (thermiques or []):
                    nom = centrale.nom
                    if nom not in gen_names:
                        continue
                    try:
                        infra = InfraThermique(centrale)
                        infra.charger_scenario(scenario)
                        prod = infra.calculer_production()
                        if prod is not None and "production_mwh" in prod.columns:
                            # production_mwh est en MW constant (= puissance_nominale) sauf maintenance
                            p_nom = float(centrale.puissance_nominal)
                            if p_nom > 0:
                                aligned = prod["production_mwh"].reindex(snapshots).fillna(0.0)
                                p_max_pu_cols[nom] = (aligned / p_nom).clip(0.0, 1.0)
                    except Exception as exc:
                        logger.warning("Echec p_max_pu thermique %s: %s", centrale.nom, exc)
            except Exception as exc:
                logger.warning("Echec fetch thermiques pour timeseries: %s", exc)

        # --- Fallback pour generateurs encore sans profil ---
        # Seul hydro_reservoir n'a pas de calculer_production() implemente
        for _, gen in generators_df.iterrows():
            name = gen.get("name")
            carrier = str(gen.get("carrier", ""))
            if not name or name in p_max_pu_cols:
                continue
            if carrier == "hydro_reservoir":
                p_max_pu_cols[name] = 0.95   # InfraHydro.calculer_production() retourne None pour reservoir
            elif carrier == "hydro_fil":
                # Profil saisonnier appliqué via _apply_hydro_fil_seasonal_profile() après le cache
                p_max_pu_cols[name] = pd.Series(
                    [_FIL_MONTHLY_CF[ts.month - 1] for ts in snapshots],
                    index=snapshots,
                )
            else:
                p_max_pu_cols[name] = 1.0

        # Construire les DataFrames en une seule passe (évite la fragmentation mémoire)
        p_max_pu = pd.DataFrame(p_max_pu_cols, index=snapshots)
        marginal_cost = pd.DataFrame(marginal_cost_cols, index=snapshots)

        # --- Appliquer la contrainte de réserve stratégique sur les réservoirs ---
        if _reservoir_pmax_for_later is not None:
            for col in _reservoir_pmax_for_later.columns:
                if col in p_max_pu.columns:
                    p_max_pu[col] = _reservoir_pmax_for_later[col]

        # Éliminer les valeurs quasi-nulles (<1e-4) → exactement 0.0
        # Évite les "excessively small row bounds" dans HiGHS :
        # une colonne p_max_pu=1e-6 crée une contrainte  0 ≤ p ≤ 1e-6 × p_nom  (~0.001 MW)
        # qui est numériquement indiscernable de zéro pour le solveur LP.
        if not p_max_pu.empty:
            p_max_pu = p_max_pu.where(p_max_pu >= 1e-4, 0.0)

        # ------------------------------------------------------------------
        # Sauvegarde cache parquet TOUJOURS à la résolution horaire
        # (permet de réutiliser le cache pour n'importe quelle résolution cible)
        # ------------------------------------------------------------------
        _has_variable_profiles = any(
            isinstance(v, pd.Series) or (isinstance(v, float) and v != 1.0)
            for v in p_max_pu_cols.values()
        )
        if not p_max_pu.empty and _has_variable_profiles:
            _save_pmax_to_cache(_cache_key, p_max_pu)

        # Rééchantillonnage hebdomadaire : 8760h → 52 moyennes (une par semaine)
        # PyPSA détecte automatiquement l'espacement de 168h et pondère l'objectif LP
        # en conséquence (snapshot_weightings = 168).
        p_max_pu = _aggregate_to_resolution(p_max_pu, resolution)
        marginal_cost = _aggregate_to_resolution(marginal_cost, resolution, fill=None)

        return p_max_pu, marginal_cost

    def load_demand_profile(
        self,
        scenario: Any,
        db: Any,
        resolution: str = "horaire",
        buses_df: Optional[pd.DataFrame] = None,
    ) -> pd.DataFrame:
        """Charge le profil de demande (cible: `network.loads_t.p_set`).

        Source : demande.db (99 MRC québécoises, horaire, kW → converti en MW).
        La demande par MRC est agrégée (tous secteurs) puis répartie géographiquement
        sur les 75 bus Conso du Nouveau Réseau via appariement au plus proche voisin.
        Colonnes retournées : Conso1, Conso2, ..., Conso75

        resolution : "horaire" (8760 snapshots) ou "hebdomadaire" (52 moyennes hebdo).
        buses_df   : DataFrame de topologie déjà chargé — évite un double chargement xlsx.
        """
        # Toujours charger à la résolution horaire (source de vérité)
        snapshots = _build_snapshots_from_scenario(scenario)

        # Topologie pour les coordonnées des bus Conso
        if buses_df is not None and not buses_df.empty:
            conso_buses = buses_df
        else:
            topology = self.load_topology_from_db(db)
            conso_buses = topology["buses"]

        demand = _load_demand_from_demande_db(snapshots, scenario, conso_buses)

        demand = _aggregate_to_resolution(demand, resolution)

        return demand


# ---------------------------------------------------------------------------
# Topologie : chargement depuis les xlsx Nouveau Réseau
# ---------------------------------------------------------------------------

def _make_line_types_df() -> pd.DataFrame:
    """Paramètres AC standard pour les types de lignes du Nouveau Réseau.

    Source principale : Hydro-Québec, *Caractéristiques des lignes*,
    document du cours ELE8452 Réseaux électriques, Polytechnique Montréal
    (r, x, b, Zc, capacité thermique pour 69, 120, 161, 230, 315, 735 kV).

    Les niveaux 345, 450 et 320 kV ne sont pas couverts par la source :
    valeurs extrapolées, conservées pour rétrocompatibilité.
        - 450 kV : proxy AC du HVDC ±450 kV Radisson-Nicolet-Sandy Pond.
        - 320 kV : approximation HVDC.
        - 345 kV : interconnexion Madawaska (NB).

    Note : le SIL (puissance naturelle V²/Zc) n'est pas utilisé à
    l'exécution. Il a servi à calibrer hors-ligne les valeurs de
    `_SNOM_BASE_PER_TYPE` (cf. network_builder.py) via la méthode
    SIL × facteur St. Clair, plafonnée par la capacité thermique PDF.
    """
    types = [
        # name,         f_nom, r_per_length, x_per_length, b_per_length (µS/km)
        # --- Valeurs PDF HQ ELE8452 ---
        ("735kV_line",   60,   0.0100,       0.3300,       4.9),
        ("315kV_line",   60,   0.0280,       0.3600,       4.3),
        ("230kV_line",   60,   0.0550,       0.4900,       3.4),
        ("161kV_line",   60,   0.0750,       0.4900,       3.4),
        ("120kV_line",   60,   0.0750,       0.4500,       3.7),
        ("69kV_line",    60,   0.0750,       0.4500,       3.7),
        # --- Extrapolations (non couverts par PDF) ---
        ("450kV_line",   60,   0.0250,       0.2750,       3.8),  # proxy HVDC ±450
        ("345kV_line",   60,   0.0390,       0.3170,       3.5),  # interco NB
        ("320kV_line",   60,   0.0420,       0.3300,       3.4),  # HVDC approx
    ]
    return pd.DataFrame(
        types,
        columns=["name", "f_nom", "r_per_length", "x_per_length", "b_per_length"],
    )


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance géodésique en km entre deux points (lat/lon en degrés)."""
    r1, r2 = radians(lat1), radians(lat2)
    dr, dl = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dr / 2) ** 2 + cos(r1) * cos(r2) * sin(dl / 2) ** 2
    return 6371.0 * 2 * atan2(sqrt(a), sqrt(1 - a))








# ---------------------------------------------------------------------------
# Demande : chargement depuis demande.db avec mapping MRC → bus Conso
# ---------------------------------------------------------------------------

# Correspondance scenario.weather (int) → chaîne demande.db
_WEATHER_MAP     = {1: "warm", 2: "typical", 3: "cold"}
# Correspondance scenario.consomation (int) → chaîne demande.db
_CONSOMATION_MAP = {1: "PV", 2: "UB"}


_DEMAND_CACHE: Dict[str, pd.DataFrame] = {}


def _load_demand_from_demande_db(
    snapshots: pd.DatetimeIndex,
    scenario: Any,
    buses_df: pd.DataFrame,
) -> pd.DataFrame:
    """Charge la demande horaire par MRC depuis demande.db.

    Étapes :
    1. Requête SQL : SUM(electricity) GROUP BY date, MRC  (kW)
    2. Pivot  → wide (index=datetime, colonnes=MRC)
    3. Mapping MRC → Conso bus le plus proche (coordonnées)
    4. Agrégation par bus Conso, conversion kW → MW
    5. Alignement sur snapshots

    Résultat caché en mémoire (clé = weather+conso+dates).
    """
    # Bus Conso du Nouveau Réseau (avec coordonnées)
    conso_df = _get_conso_buses(buses_df)
    empty = pd.DataFrame(
        0.0, index=snapshots,
        columns=list(conso_df["name"]) if not conso_df.empty else [],
    )

    if not _DEMANDE_DB_PATH.exists():
        logger.warning("demande.db introuvable : %s", _DEMANDE_DB_PATH)
        return empty

    # Accepter à la fois int (test standalone) et enum (DB réelle : Weather.typical → .value=2)
    raw_weather = getattr(scenario, "weather", 1)
    weather_int = raw_weather.value if hasattr(raw_weather, "value") else int(raw_weather)
    weather_str = _WEATHER_MAP.get(weather_int, "warm")
    raw_conso = getattr(scenario, "consomation", 2)
    conso_int = raw_conso.value if hasattr(raw_conso, "value") else int(raw_conso)
    scenario_str = _CONSOMATION_MAP.get(conso_int, "UB")

    # Cache disque + mémoire : la requête SQL sur 83M lignes prend 2+ min.
    # Clé basée sur les dates du scénario (pas sur la résolution des snapshots) :
    # la même requête sert pour "horaire" et "hebdomadaire" — évite la double exécution SQL.
    _date_debut = str(getattr(scenario, "date_de_debut", snapshots[0]))
    _date_fin   = str(getattr(scenario, "date_de_fin",   snapshots[-1]))
    _dcache_key = f"{weather_str}|{scenario_str}|{_date_debut}|{_date_fin}|{len(conso_df)}"
    if _dcache_key in _DEMAND_CACHE:
        cached = _DEMAND_CACHE[_dcache_key]
        logger.info("Cache demande: HIT mémoire (%d snapshots, %d bus)", cached.shape[0], cached.shape[1])
        return cached.reindex(snapshots, method="nearest", tolerance="1h").fillna(0.0)
    # Cache disque parquet
    _demand_cache_dir = _PROFILES_CACHE_DIR / "demand"
    _demand_cache_file = _demand_cache_dir / f"demand_{hashlib.sha256(_dcache_key.encode()).hexdigest()[:12]}.parquet"
    if _demand_cache_file.exists():
        try:
            cached = pd.read_parquet(_demand_cache_file)
            _DEMAND_CACHE[_dcache_key] = cached
            logger.info(
                "Cache demande: HIT disque %s (%d snapshots, %d bus)",
                _demand_cache_file.name, cached.shape[0], cached.shape[1],
            )
            return cached.reindex(snapshots, method="nearest", tolerance="1h").fillna(0.0)
        except Exception:
            _demand_cache_file.unlink(missing_ok=True)
    # demande.db stocke les dates avec espace ("2035-01-01 00:00:00")
    # mais le scénario utilise le format ISO avec T ("2035-01-01T00:00:00").
    # SQLite compare en texte : espace (32) < T (84), ce qui exclurait toutes
    # les lignes si on ne remplace pas le T.
    date_debut = str(getattr(scenario, "date_de_debut", "2035-01-01")).replace("T", " ")
    date_fin   = str(getattr(scenario, "date_de_fin",   "2035-12-31")).replace("T", " ")

    try:
        conn = sqlite3.connect(f"file:{_DEMANDE_DB_PATH}?mode=ro", uri=True)

        # Agrégation par date et MRC (tous secteurs sommés).
        # Exclure la ligne MRC='Total' qui est la somme agrégée de toutes les MRC
        # et provoquerait un double-comptage de toute la demande québécoise.
        query = """
            SELECT d.date, m.MRC, SUM(d.electricity) AS mw_kw
            FROM Demande d
            JOIN Metadata m ON d.meta_id = m.id
            WHERE m.weather  = ?
              AND m.scenario = ?
              AND d.date BETWEEN ? AND ?
              AND m.MRC != 'Total'
            GROUP BY d.date, m.MRC
            ORDER BY d.date
        """
        raw = pd.read_sql_query(
            query, conn,
            params=(weather_str, scenario_str, date_debut, date_fin),
        )
        conn.close()

        if raw.empty:
            logger.warning("Aucune donnée demande pour weather=%s scenario=%s", weather_str, scenario_str)
            return empty

        # kW → MW
        raw["mw"] = raw["mw_kw"] / 1000.0

        # Pivot wide : index=datetime, colonnes=MRC_name
        raw["date"] = pd.to_datetime(raw["date"])
        wide = raw.pivot(index="date", columns="MRC", values="mw")
        wide.index = pd.to_datetime(wide.index)

        if conso_df.empty:
            logger.warning("Aucun bus Conso trouvé dans la topologie")
            return empty

        # Mapping MRC → bus Conso (distance géodésique)
        mrc_to_bus = _build_mrc_to_conso_mapping(wide.columns.tolist(), conso_df)

        # Agrégation : pour chaque bus Conso, sommer les MRC qui lui sont assignées
        result = pd.DataFrame(0.0, index=wide.index, columns=conso_df["name"].tolist())
        for mrc_name, bus_name in mrc_to_bus.items():
            if mrc_name in wide.columns and bus_name in result.columns:
                result[bus_name] += wide[mrc_name].fillna(0.0)

        # Aligner sur les snapshots du scénario
        aligned = result.reindex(snapshots, method="nearest", tolerance="1H").fillna(0.0)

        # +7% uplift pour représenter les pertes de transport et distribution (T&D)
        aligned = aligned * 1.07

        _DEMAND_CACHE[_dcache_key] = aligned
        # Sauvegarder en parquet pour les runs suivants (évite la requête SQL de 2 min)
        try:
            _demand_cache_dir.mkdir(parents=True, exist_ok=True)
            aligned.to_parquet(_demand_cache_file)
            logger.info(
                "Cache demande: SAVED disque %s (%.1f KB)",
                _demand_cache_file.name, _demand_cache_file.stat().st_size / 1024,
            )
        except Exception as exc:
            logger.warning("Cache demande: échec sauvegarde: %s", exc)
        return aligned

    except Exception as exc:
        logger.warning("Echec chargement demande.db : %s", exc)
        return empty


def _get_conso_buses(buses_df: pd.DataFrame) -> pd.DataFrame:
    """Retourne les bus de type 'conso' avec leurs coordonnées."""
    if buses_df is None or buses_df.empty:
        return pd.DataFrame(columns=["name", "x", "y"])
    mask = buses_df["type"].str.lower() == "conso"
    return buses_df.loc[mask, ["name", "x", "y"]].dropna(subset=["x", "y"]).reset_index(drop=True)


def _build_mrc_to_conso_mapping(
    mrc_names: List[str],
    conso_df: pd.DataFrame,
) -> Dict[str, str]:
    """Pour chaque MRC, retourne le nom du bus Conso le plus proche.

    Utilise les centroïdes MRC de db/CSVs/buses.csv (colonnes mrc_*).
    Fallback : distribution uniforme sur le premier bus si lat/lon indisponible.
    """
    # Charger les coordonnées des MRC (db/CSVs/buses.csv, lignes mrc_*)
    mrc_coords: Dict[str, Tuple[float, float]] = {}
    if _MRC_BUSES_CSV.exists():
        try:
            mrc_csv = pd.read_csv(_MRC_BUSES_CSV)
            # Colonnes : name, voltage, latitude, longitude, type, control
            mrc_rows = mrc_csv[mrc_csv["name"].str.startswith("mrc_")]
            for _, row in mrc_rows.iterrows():
                raw_name = str(row["name"])[4:]  # enlever le préfixe "mrc_"
                mrc_coords[raw_name] = (float(row["latitude"]), float(row["longitude"]))
        except Exception as exc:
            logger.warning("Echec lecture MRC coords: %s", exc)

    conso_arr = conso_df[["x", "y"]].values  # (lat, lon)
    conso_names = list(conso_df["name"])

    mapping: Dict[str, str] = {}
    for mrc in mrc_names:
        lat_lon = mrc_coords.get(mrc)
        if lat_lon is None:
            # Fallback : premier bus Conso
            mapping[mrc] = conso_names[0] if conso_names else ""
            continue
        # Distance euclidienne en degrés (suffisant pour proximité relative)
        lat, lon = lat_lon
        dists = np.sqrt((conso_arr[:, 0] - lat) ** 2 + (conso_arr[:, 1] - lon) ** 2)
        nearest_idx = int(np.argmin(dists))
        mapping[mrc] = conso_names[nearest_idx]

    return mapping


def load_topology_from_db(db: Any) -> Dict[str, pd.DataFrame]:
    return NetworkDataLoaderBis().load_topology_from_db(db)


def load_generation_profiles(scenario: Any, liste_infra: Any, db: Any) -> Dict[str, pd.DataFrame]:
    return NetworkDataLoaderBis().load_generation_profiles(scenario, liste_infra, db)


def load_demand_profile(scenario: Any, db: Any) -> pd.DataFrame:
    return NetworkDataLoaderBis().load_demand_profile(scenario, db)


def _parse_ids(raw_value: Any) -> list[int] | None:
    """Parse IDs from either a comma-separated string ('1,2,3') or a list of
    Pydantic objects (each having an `.id` attribute) sent by the frontend."""
    if not raw_value:
        return None
    # List of objects (e.g. EolienneParcBase instances from SimulationInfraGroup)
    if isinstance(raw_value, list):
        ids = []
        for item in raw_value:
            if hasattr(item, "id"):
                ids.append(int(item.id))
            else:
                try:
                    ids.append(int(item))
                except (TypeError, ValueError):
                    pass
        return ids or None
    # Comma-separated string fallback ('1,2,3')
    parts = [x.strip() for x in str(raw_value).split(",") if x.strip().lstrip("-").isdigit()]
    return [int(x) for x in parts] or None


def _build_snapshots_from_scenario(scenario: Any) -> pd.DatetimeIndex:
    return pd.date_range(
        start=scenario.date_de_debut,
        end=scenario.date_de_fin,
        freq=scenario.pas_de_temps,
    )


def _run_async(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
        logger.warning("Impossible d'executer un CRUD async depuis une boucle active dans ce loader sync.")
        return None
    except RuntimeError:
        return asyncio.run(coro)


def _records_to_df(records: Any) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame([getattr(record, "__dict__", {}) for record in records])
    return df.drop(columns=["_sa_instance_state"], errors="ignore")


def _select_columns(df: pd.DataFrame, expected: list[str]) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=expected)
    for col in expected:
        if col not in df.columns:
            df[col] = None
    return df[expected]


def _generators_from_user_infras(
    liste_infra: Any,
    buses_df: "pd.DataFrame | None",
) -> list[dict[str, Any]]:
    """Construit les lignes de générateurs pour les infrastructures créées par l'utilisateur.

    Lit directement les attributs Pydantic du payload sans passer par la base de données.
    Le format de sortie est identique à celui de ``_fetch_generators_from_db``.
    """
    rows: list[dict[str, Any]] = []

    # Éolien
    for infra in getattr(liste_infra, "parc_eoliens", None) or []:
        if not getattr(infra, "is_user_created", False):
            continue
        bus = _find_bus_for_generator(infra.latitude, infra.longitude, buses_df)
        p_nom = float(infra.puissance_nominal) * float(infra.nombre_eoliennes) * 1e-3
        rows.append({
            "name": infra.nom,
            "bus": bus,
            "carrier": "eolien",
            "p_nom": p_nom,
            "p_nom_extendable": False,
            "p_nom_min": 0.0,
            "p_nom_max": None,
            "marginal_cost": 0.1,
        })

    # Solaire
    for infra in getattr(liste_infra, "parc_solaires", None) or []:
        if not getattr(infra, "is_user_created", False):
            continue
        bus = _find_bus_for_generator(infra.latitude, infra.longitude, buses_df)
        p_nom_mw = float(infra.puissance_nominal) * float(infra.nombre_panneau) / 1000.0
        rows.append({
            "name": infra.nom,
            "bus": bus,
            "carrier": "solaire",
            "p_nom": p_nom_mw,
            "p_nom_extendable": False,
            "p_nom_min": 0.0,
            "p_nom_max": None,
            "marginal_cost": 0.1,
        })

    # Hydro
    for infra in getattr(liste_infra, "central_hydroelectriques", None) or []:
        if not getattr(infra, "is_user_created", False):
            continue
        type_barrage = str(getattr(infra, "type_barrage", "")).strip().lower()
        carrier = "hydro_reservoir" if type_barrage == "reservoir" else "hydro_fil"
        nb_turbines = max(1, int(getattr(infra, "nb_turbines", 1)))
        nb_maint = max(0, int(getattr(infra, "nb_turbines_maintenance", 0)))
        ratio_dispo = max(1, nb_turbines - nb_maint) / nb_turbines
        bus = _find_bus_for_generator(infra.latitude, infra.longitude, buses_df)
        rows.append({
            "name": infra.nom,
            "bus": bus,
            "carrier": carrier,
            "p_nom": float(infra.puissance_nominal),
            "p_nom_extendable": False,
            "p_nom_min": 0.0,
            "p_nom_max": None,
            "p_min_pu": 0.0,
            "marginal_cost": 7.0 if carrier == "hydro_reservoir" else 0.0,
            "ratio_dispo": ratio_dispo,
            "regulation": str(getattr(infra, "regulation", None) or "Pluriannuel"),
        })

    # Thermique
    for infra in getattr(liste_infra, "central_thermique", None) or []:
        if not getattr(infra, "is_user_created", False):
            continue
        bus = _find_bus_for_generator(infra.latitude, infra.longitude, buses_df)
        rows.append({
            "name": infra.nom,
            "bus": bus,
            "carrier": "thermique",
            "p_nom": float(infra.puissance_nominal) * 1e-3,
            "p_nom_extendable": False,
            "p_nom_min": 0.0,
            "p_nom_max": None,
            "marginal_cost": 30.0,
        })

    # Nucléaire
    for infra in getattr(liste_infra, "central_nucleaire", None) or []:
        if not getattr(infra, "is_user_created", False):
            continue
        bus = _find_bus_for_generator(infra.latitude, infra.longitude, buses_df)
        rows.append({
            "name": infra.nom,
            "bus": bus,
            "carrier": "nucleaire",
            "p_nom": float(infra.puissance_nominal) * 1e-3,
            "p_nom_extendable": False,
            "p_nom_min": 0.0,
            "p_nom_max": None,
            "marginal_cost": 0.2,
        })

    if rows:
        logger.info(
            "UserInfras : %d générateur(s) user-created ajoutés directement depuis le payload.",
            len(rows),
        )
    return [r for r in rows if r.get("name")]


def _fetch_entities(db: Any, model: Any, ids: list[int] | None) -> pd.DataFrame:
    if ids:
        records = _run_async(read_multiple_by_id(db, model, ids))
    else:
        records = _run_async(read_all_data(db, model))
    return _records_to_df(records)


def _find_bus_for_generator(lat: float | None, lon: float | None, buses_df: pd.DataFrame) -> str | None:
    """Retourne le bus interne le plus proche (Haversine).

    Utilise notre propre _haversine_km (x=lat, y=lon dans buses_df) au lieu
    de GeoUtils qui suppose la convention inverse (x=lon, y=lat) et retourne
    des résultats incorrects avec nos données.
    Les bus Etranger et Interco sont exclus : les générateurs HQ doivent être
    connectés au réseau interne.
    """
    if lat is None or lon is None or buses_df is None or buses_df.empty:
        return None
    if "x" not in buses_df.columns or "y" not in buses_df.columns:
        # Pas de coordonnées disponibles → premier bus Conso
        conso = buses_df[buses_df["type"].str.lower() == "conso"] if "type" in buses_df.columns else pd.DataFrame()
        return conso.iloc[0]["name"] if not conso.empty else (buses_df.iloc[0]["name"] if not buses_df.empty else None)

    # Exclure les bus étrangers (Etranger/Interco) pour les générateurs internes HQ.
    if "name" in buses_df.columns:
        mask = ~buses_df["name"].str.startswith(("Etranger", "Interco"), na=False)
        internal_df = buses_df[mask]
    else:
        internal_df = buses_df
    search_df = internal_df if not internal_df.empty else buses_df

    try:
        gen_lat, gen_lon = float(lat), float(lon)
        best_bus: str | None = None
        best_dist = float("inf")
        for _, bus_row in search_df.iterrows():
            bus_lat = bus_row.get("x")  # x = latitude dans notre convention
            bus_lon = bus_row.get("y")  # y = longitude
            if bus_lat is None or bus_lon is None:
                continue
            try:
                d = _haversine_km(gen_lat, gen_lon, float(bus_lat), float(bus_lon))
                if d < best_dist:
                    best_dist = d
                    best_bus = bus_row.get("name")
            except (TypeError, ValueError):
                continue
        if best_bus:
            return best_bus
    except Exception as exc:
        logger.debug("_find_bus_for_generator Haversine failed: %s", exc)

    # Fallback : premier bus Conso
    conso = buses_df[buses_df["type"].str.lower() == "conso"] if "type" in buses_df.columns else pd.DataFrame()
    return conso.iloc[0]["name"] if not conso.empty else (buses_df.iloc[0]["name"] if not buses_df.empty else None)


def _resolve_generator_bus(
    raw_bus: Any,
    lat: Any,
    lon: Any,
    buses_df: "pd.DataFrame | None",
    gen_name: Any = None,
) -> "str | None":
    """Résout le bus d'un générateur, en rejetant les bus Étranger/Interco.

    Un générateur assigné à un bus Étranger (ex. Manic-5 → Etranger8) biaise
    la comptabilité de production : son énergie apparaît comme un import alors
    qu'il s'agit d'une centrale HQ interne. On le réassigne au bus interne le
    plus proche via les coordonnées géographiques.
    """
    bus = raw_bus
    if bus and (str(bus).startswith("Etranger") or str(bus).startswith("Interco")):
        logger.warning(
            "Générateur '%s' : bus '%s' est externe — réassignation au bus interne le plus proche.",
            gen_name or "?", bus,
        )
        bus = None
    return bus or _find_bus_for_generator(lat, lon, buses_df)


def _fetch_generators_from_db(db: Any, model: Any, ids: list[int] | None, source_type: str, buses_df: pd.DataFrame | None = None) -> list[dict[str, Any]]:
    df = _fetch_entities(db, model, ids)
    if df.empty:
        return []

    rows: list[dict[str, Any]] = []

    if source_type == "eolien":
        for _, row in df.iterrows():
            bus = _resolve_generator_bus(row.get("bus"), row.get("latitude"), row.get("longitude"), buses_df, row.get("nom"))
            rows.append(
                {
                    "name": row.get("nom"),
                    "bus": bus,
                    "carrier": "eolien",
                    "p_nom": float(row.get("puissance_nominal", 0.0)) * float(row.get("nombre_eoliennes", 0.0)) * 1e-3,
                    "p_nom_extendable": False,
                    "p_nom_min": 0.0,
                    "p_nom_max": None,
                    "marginal_cost": 0.1,
                }
            )
    elif source_type == "solaire":
        for _, row in df.iterrows():
            bus = _resolve_generator_bus(row.get("bus"), row.get("latitude"), row.get("longitude"), buses_df, row.get("nom"))
            # puissance_nominal = kW/panneau dans la DB (pas MW du parc).
            # p_nom PyPSA = puissance_nominal_kW * nombre_panneau / 1000 → MW.
            p_nom_kw_per_panel = float(row.get("puissance_nominal", 0.0))
            n_panels = float(row.get("nombre_panneau", 1))
            p_nom_mw = p_nom_kw_per_panel * n_panels / 1000.0
            rows.append(
                {
                    "name": row.get("nom"),
                    "bus": bus,
                    "carrier": "solaire",
                    "p_nom": p_nom_mw,
                    "p_nom_extendable": False,
                    "p_nom_min": 0.0,
                    "p_nom_max": None,
                    "marginal_cost": 0.1,
                }
            )
    elif source_type == "hydro":
        for _, row in df.iterrows():
            type_barrage = str(row.get("type_barrage", "")).strip().lower()
            carrier = "hydro_reservoir" if type_barrage == "reservoir" else "hydro_fil"
            p_nom = float(row.get("puissance_nominal", 0.0))
            nb_turbines = max(1, int(row.get("nb_turbines", 1)))
            nb_turb_maint = max(0, int(row.get("nb_turbines_maintenance", 0)))
            nb_dispo = max(1, nb_turbines - nb_turb_maint)
            ratio_dispo = nb_dispo / nb_turbines
            bus = _resolve_generator_bus(row.get("bus"), row.get("latitude"), row.get("longitude"), buses_df, row.get("nom"))

            # p_min_pu :
            # - Hydro réservoir : 0.0 (dispatchable). Le déversement n'est PAS modélisé
            #   ici et ne doit pas être assimilé à une production minimale obligatoire.
            # - Hydro fil de l'eau : géré via _HYDRO_FIL_MIN_PU_FRACTION dans network_builder.
            p_min_pu = 0.0

            rows.append(
                {
                    "name": row.get("nom"),
                    "bus": bus,
                    "carrier": carrier,
                    "p_nom": p_nom,
                    # p_nom_extendable=False : le réservoir est un actif existant à capacité fixe.
                    # Avec extendable=True + capital_cost=0 + p_nom_min=0, le LP fixait
                    # p_nom_opt=0 (solution dégénérée valide) → dispatch réservoir = 0 → imports ↑.
                    "p_nom_extendable": False,
                    "p_nom_min": 0.0,
                    "p_nom_max": None,
                    "p_min_pu": p_min_pu,
                    "marginal_cost": 7.0 if carrier == "hydro_reservoir" else 0.0,
                    # ratio_dispo : fraction de turbines disponibles (hors maintenance).
                    # Utilisé par _compute_initial_reservoir_pmax pour borner p_max_pu.
                    "ratio_dispo": ratio_dispo,
                    # regulation : "Annuel" ou "Pluriannuel" — détermine la courbe water value.
                    "regulation": str(row.get("regulation", "Pluriannuel")).strip(),
                }
            )
    elif source_type == "thermique":
        for _, row in df.iterrows():
            p_nom = float(row.get("puissance_nominal", 0.0)) * 1e-3
            bus = _resolve_generator_bus(row.get("bus"), row.get("latitude"), row.get("longitude"), buses_df, row.get("nom"))
            rows.append(
                {
                    "name": row.get("nom"),
                    "bus": bus,
                    "carrier": "thermique",
                    "p_nom": p_nom,
                    "p_nom_extendable": False,
                    "p_nom_min": 0.0,
                    "p_nom_max": None,
                    "marginal_cost": 30.0,
                }
            )
    elif source_type == "nucleaire":
        for _, row in df.iterrows():
            bus = _resolve_generator_bus(row.get("bus"), row.get("centrale_nucleaire_lat", None), row.get("centrale_nucleaire_lon", None), buses_df, row.get("centrale_nucleaire_nom"))
            rows.append(
                {
                    "name": row.get("centrale_nucleaire_nom"),
                    "bus": bus,
                    "carrier": "nucleaire",
                    "p_nom": float(row.get("puissance_nominal", 0.0)) * 1e-3,
                    "p_nom_extendable": False,
                    "p_nom_min": 0.0,
                    "p_nom_max": None,
                    "marginal_cost": 0.2,
                }
            )

    return [row for row in rows if row.get("name")]


# ---------------------------------------------------------------------------
# Niveau initial des réservoirs
# ---------------------------------------------------------------------------

# Niveau initial par défaut : 80 % du volume utile.
# Correspond au niveau typique HQ en entrée d'année (après l'automne humide,
# avant le tirage hivernal). Faute de données temps-réel publiques sur le
# remplissage (la DB Hydro stocke volume_reservoir max en m³ mais pas le
# niveau courant), cette valeur fixe est plus simple et suffisamment réaliste.
# Le feed-forward hydraulique (ReservoirDamFeed) fera évoluer les niveaux
# chunk par chunk en fonction du dispatch OPF réel.
_DEFAULT_RESERVOIR_FILL = 0.80


def _get_initial_reservoir_fill(scenario: Any) -> Dict[str, float]:
    """Retourne le niveau de remplissage initial des réservoirs par barrage.

    Sources (priorité décroissante) :
    1. scenario.pourcentage_reservoir_initial : dict {nom_barrage: float} ∈ [0, 1]
    2. scenario.pourcentage_reservoir_initial : float (niveau global)
    3. _DEFAULT_RESERVOIR_FILL = 80 %

    Le niveau global est stocké sous la clé spéciale "_global" et utilisé comme
    fallback pour les barrages non listés individuellement.
    """
    fill: Dict[str, float] = {}
    reservoir_attr = getattr(scenario, "pourcentage_reservoir_initial", None)
    if isinstance(reservoir_attr, dict):
        fill = {k: float(v) for k, v in reservoir_attr.items()}
        if "_global" not in fill:
            fill["_global"] = _DEFAULT_RESERVOIR_FILL
    elif isinstance(reservoir_attr, (int, float)):
        fill["_global"] = max(0.0, min(1.0, float(reservoir_attr)))
    else:
        fill["_global"] = _DEFAULT_RESERVOIR_FILL
    return fill


# NOTE : _water_value_cost() et _compute_fill_trajectory() ont été supprimés.
# La courbe water_value_cost() est désormais importée depuis utils.reservoir_tracker.
# Le coût initial est calculé depuis le fill initial du scénario (pas une trajectoire fictive).
# La mise à jour chunk par chunk est faite par optimizer._update_reservoir_costs_and_pmax()
# via ReservoirDamFeed (bilan hydraulique post-dispatch réel).

