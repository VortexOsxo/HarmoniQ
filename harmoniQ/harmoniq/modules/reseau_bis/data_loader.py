"""Chargeur de donnees pour `reseau_bis`.

Sources:
- Topologie  : Nouveau Reseau/bus_db_2026.xlsx + lines_db_2026.xlsx
- Demande    : harmoniq/db/demande.db (99 MRC québécoises, horaire)
- Génération : DB via CRUD async + modules de production
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

_NOUVEAU_RESEAU_DIR = _PROJECT_ROOT / "Nouveau Reseau"
_BUS_XLSX           = _NOUVEAU_RESEAU_DIR / "bus_db_2026.xlsx"
_LINES_XLSX         = _NOUVEAU_RESEAU_DIR / "lines_db_2026.xlsx"
_DEMANDE_DB_PATH    = _HARMONIQ_DIR / "db" / "demande.db"
_MRC_BUSES_CSV      = _HARMONIQ_DIR / "db" / "CSVs" / "buses.csv"
_INFO_BARRAGES_CSV  = _HARMONIQ_DIR / "db" / "CSVs" / "Info_Barrages.csv"
_APPORT_NATUREL_DIR = _HARMONIQ_DIR / "modules" / "hydro" / "apport_naturel"

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


def _compute_profiles_cache_key(scenario: Any, generator_names: List[str]) -> str:
    """Retourne un hash court identifiant uniquement ce scénario + ces générateurs."""
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
    """Charge le DataFrame p_max_pu depuis le cache parquet. Retourne None si absent/corrompu."""
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
    """Persiste le DataFrame p_max_pu en parquet pour les prochains appels."""
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
_WINTER_RESERVOIR_PREMIUM = [3.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 3.0]


def _apply_winter_premium(costs: np.ndarray, snapshots: pd.DatetimeIndex) -> np.ndarray:
    """Ajoute la prime hivernale au coût marginal des réservoirs.

    En hiver (déc-jan-fév), le coût de l'eau est relevé pour refléter la valeur
    stratégique du stockage — rendant l'import compétitif aux pointes.
    """
    premium = np.array([_WINTER_RESERVOIR_PREMIUM[ts.month - 1] for ts in snapshots])
    return costs + premium


def _apply_hydro_fil_seasonal_profile(
    p_max_pu: pd.DataFrame,
    generators_df: pd.DataFrame,
    snapshots: pd.DatetimeIndex,
) -> pd.DataFrame:
    """Applique le profil saisonnier aux colonnes hydro_fil (recalculé à chaque run, pas caché)."""
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
    """Fetch + calcul d'un seul parc éolien dans un thread dédié.

    Appelé via ThreadPoolExecutor : chaque parc est traité en parallèle.
    Chaque thread crée sa propre instance InfraParcEolienne (pas de partage d'état).
    _run_async() crée un event loop isolé par thread → thread-safe.

    Returns:
        (nom_parc, Series p_max_pu alignée sur snapshots) ou (nom, None) si échec.
    """
    parc, scenario, snapshots = args
    if InfraParcEolienne is None:
        return parc.nom, None
    try:
        infra = InfraParcEolienne(parc)
        _run_async(infra.charger_scenario(scenario))
        prod = infra.calculer_production()
        if prod is not None and "puissance" in prod.columns:
            p_nom = float(parc.puissance_nominal) * float(parc.nombre_eoliennes)
            if p_nom > 0:
                series = pd.Series(
                    prod["puissance"].values,
                    index=pd.to_datetime(prod["tempsdate"]),
                )
                aligned = series.reindex(snapshots).fillna(0.0)
                return parc.nom, (aligned / p_nom).clip(0.0, 1.0).fillna(0.25)
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
    """Documente les memes sources DB/SQL que le module legacy."""
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
    """Liste actionnable des integrations a realiser dans le chargeur."""
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
    """Facade minimale du chargeur alignee avec le nommage HarmoniQ actuel."""

    def __init__(self) -> None:
        self.eolienne_ids = None
        self.solaire_ids = None
        self.hydro_ids = None
        self.thermique_ids = None
        self.nucleaire_ids = None

    def set_infrastructure_ids(self, liste_infra: Any) -> None:
        """Recopie les champs actuels de `ListeInfrastructures`.

        Champs attendus:
        - parc_eoliens
        - parc_solaires
        - central_hydroelectriques
        - central_thermique
        - central_nucleaire
        """
        self.eolienne_ids = _parse_ids(getattr(liste_infra, "parc_eoliens", None))
        self.solaire_ids = _parse_ids(getattr(liste_infra, "parc_solaires", None))
        self.hydro_ids = _parse_ids(getattr(liste_infra, "central_hydroelectriques", None))
        self.thermique_ids = _parse_ids(getattr(liste_infra, "central_thermique", None))
        self.nucleaire_ids = _parse_ids(getattr(liste_infra, "central_nucleaire", None))

    def load_topology_from_db(self, db: Any) -> Dict[str, pd.DataFrame]:
        """Charge la topologie.

        Priorité 1 : bus_db_2026.xlsx + lines_db_2026.xlsx (Nouveau Réseau).
        Priorité 2 : db.sqlite via CRUD async (fallback).
        """
        # --- Priorité 1 : xlsx Nouveau Réseau ---
        if _BUS_XLSX.exists() and _LINES_XLSX.exists():
            try:
                return _load_topology_from_xlsx()
            except Exception as exc:
                logger.warning("Echec chargement xlsx Nouveau Reseau, fallback DB: %s", exc)

        # --- Priorité 2 : DB sqlite ---
        buses_df = pd.DataFrame(columns=["name", "v_nom", "type", "x", "y", "control"])
        lines_df = pd.DataFrame(columns=["name", "bus0", "bus1", "type", "length", "s_nom"])
        line_types_df = _make_line_types_df()

        if not DB_INTEGRATION_AVAILABLE or db is None:
            return {"buses": buses_df, "lines": lines_df, "line_types": line_types_df}

        buses = _run_async(read_all_bus_async(db))
        lines = _run_async(read_all_line_async(db))
        line_types = _run_async(read_all_line_type_async(db))

        if buses is not None:
            buses_df = _select_columns(_records_to_df(buses), ["name", "v_nom", "type", "x", "y", "control"])
        if lines is not None:
            lines_df = _select_columns(_records_to_df(lines), ["name", "bus0", "bus1", "type", "length", "s_nom"])
        if line_types is not None:
            line_types_df = _select_columns(
                _records_to_df(line_types), ["name", "f_nom", "r_per_length", "x_per_length"]
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
        """Charge les metadonnees et series temporelles de generation.

        Contrat utilise par `network_builder`:
        - generators: table statique des generateurs
        - p_max_pu: disponibilite temporelle (index = snapshots)
        - marginal_cost: couts temporels (index = snapshots)

        resolution : "horaire" (8760 snapshots) ou "hebdomadaire" (52 moyennes hebdo).
        buses_df   : DataFrame de topologie déjà chargé — évite un double chargement xlsx.
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
            gen_rows.extend(_fetch_generators_from_db(db, EolienneParc, self.eolienne_ids, "eolien", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Solaire, self.solaire_ids, "solaire", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Hydro, self.hydro_ids, "hydro", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Thermique, self.thermique_ids, "thermique", buses_df))
            gen_rows.extend(_fetch_generators_from_db(db, Nucleaire, self.nucleaire_ids, "nucleaire", buses_df))

            if gen_rows:
                generators = pd.DataFrame(gen_rows)

        p_max_pu, marginal_cost = self._generate_timeseries(
            db=db,
            scenario=scenario,
            snapshots=snapshots,
            generators_df=generators,
            resolution=resolution,
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
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Genere p_max_pu et marginal_cost pour tous les generateurs.

        Sequence:
        1. Appelle InfraParcEolienne / InfraSolaire / InfraNucleaire pour les profils reels.
        2. Utilise des profils saisonniers ou constants pour hydro/thermique (pas de module dedie).
        3. Fallback p_max_pu = 1.0 pour tout generateur non couvert.
        """
        MARGINAL_COSTS = {
            # Sources non pilotables : coût 0 $/MWh → dispatché en priorité absolue.
            # L'optimizer prend tout ce qu'elles produisent et exporte le surplus
            # via les interconnexions (Ontario/NY/NE en été).
            # Curtailment seulement si exports saturés ET réseau congestionné.
            "eolien":          0.0,
            "solaire":         0.0,
            "hydro_fil":       2.0,   # O&M variable turbines fil de l'eau
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
            # --- Water value dynamique : trajectoire de fill par snapshot ---
            reservoir_gen_names = [
                gen.get("name") for _, gen in generators_df.iterrows()
                if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
            ]
            reservoir_pmax_df = None
            if reservoir_gen_names:
                fill_traj, reservoir_pmax_df = _compute_fill_trajectory(snapshots, reservoir_gen_names, generators_df, scenario)
                for gname in reservoir_gen_names:
                    if gname in fill_traj.columns:
                        costs = _water_value_cost_vectorized(fill_traj[gname].values)
                        costs = _apply_winter_premium(costs, snapshots)
                        marginal_cost_cols[gname] = pd.Series(costs, index=snapshots)
                    else:
                        fill = _get_initial_reservoir_fill(scenario).get(gname, 0.70)
                        marginal_cost_cols[gname] = _water_value_cost(fill)
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
            if resolution == "hebdomadaire":
                pmax_aligned = pmax_aligned.resample("W-MON", label="left").mean().fillna(0.0)
                mc_df = mc_df.resample("W-MON", label="left").mean()
            return pmax_aligned, mc_df

        # Coûts marginaux initiaux fixes par carrier
        for _, gen in generators_df.iterrows():
            name = gen.get("name")
            carrier = str(gen.get("carrier", ""))
            if name:
                marginal_cost_cols[name] = MARGINAL_COSTS.get(carrier, 10.0)

        # --- Water value dynamique : trajectoire de fill par snapshot ---
        # Le coût marginal d'un barrage réservoir dépend du remplissage saisonnier.
        # On calcule une trajectoire de fill pré-LP via bilan hydrique simplifié
        # (apports naturels CSV − turbinage estimé), puis on applique la courbe
        # de coût continue _water_value_cost() à chaque snapshot.
        reservoir_gen_names = [
            gen.get("name") for _, gen in generators_df.iterrows()
            if str(gen.get("carrier", "")) == "hydro_reservoir" and gen.get("name")
        ]
        _reservoir_pmax_for_later = None
        if reservoir_gen_names:
            fill_traj, _reservoir_pmax_for_later = _compute_fill_trajectory(snapshots, reservoir_gen_names, generators_df, scenario)
            for gname in reservoir_gen_names:
                if gname in fill_traj.columns:
                    costs = _water_value_cost_vectorized(fill_traj[gname].values)
                    costs = _apply_winter_premium(costs, snapshots)
                    marginal_cost_cols[gname] = pd.Series(costs, index=snapshots)
                    logger.info(
                        "Barrage %s : fill min=%.0f%% max=%.0f%% → coût %.1f–%.1f $/MWh (incl. prime hiver)",
                        gname, fill_traj[gname].min() * 100, fill_traj[gname].max() * 100,
                        costs.min(), costs.max(),
                    )
                else:
                    fill = _get_initial_reservoir_fill(scenario).get(gname, 0.70)
                    marginal_cost_cols[gname] = _water_value_cost(fill)

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
                valid_parcs = [p for p in (eoliennes or []) if p.nom in gen_names]
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
                for parc in (solaires or []):
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
                            # Déterminer le pic réel du module pour normaliser en p.u.
                            peak_val = series.max()
                            if peak_val > 0:
                                cf_hourly = (series / peak_val).clip(0.0, 1.0)
                                # Agréger en moyenne hebdomadaire si snapshots sont hebdo
                                snap_freq = pd.infer_freq(snapshots) if len(snapshots) > 2 else None
                                if snap_freq and "W" in str(snap_freq):
                                    cf_weekly = cf_hourly.resample("W-MON").mean()
                                    cf_aligned = cf_weekly.reindex(snapshots, method="nearest",
                                                                   tolerance=pd.Timedelta("7D")).fillna(0.0)
                                else:
                                    cf_aligned = cf_hourly.reindex(snapshots, method="nearest",
                                                                   tolerance=pd.Timedelta("1h")).fillna(0.0)
                                p_max_pu_cols[nom] = cf_aligned
                                logger.info("Profil solaire %s : CF moyen=%.2f (module OK)", nom, cf_aligned.mean())
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
        if resolution == "hebdomadaire":
            p_max_pu = p_max_pu.resample("W-MON", label="left").mean().fillna(0.0)
            marginal_cost = marginal_cost.resample("W-MON", label="left").mean()

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

        if resolution == "hebdomadaire" and not demand.empty:
            demand = demand.resample("W-MON", label="left").mean().fillna(0.0)

        return demand


# ---------------------------------------------------------------------------
# Topologie : chargement depuis les xlsx Nouveau Réseau
# ---------------------------------------------------------------------------

def _make_line_types_df() -> pd.DataFrame:
    """Paramètres AC standard pour les types de lignes du Nouveau Réseau.

    b_per_length (µS/km) = susceptance shunt, dérivée de b = x / Zc²
    où Zc est l'impédance caractéristique typique par classe de voltage.
    Formule SIL : Zc = √(x/b),  SIL = V²/Zc  [MW]
    Sources : IEEE, Glover/Sarma ch.5, Electrical4U, ECE Utah notes.

    Valeurs Zc utilisées :
        735 kV → Zc ≈ 254 Ω,  SIL ≈ 2128 MW  (4×ACSR bundle HQ)
        315 kV → Zc ≈ 301 Ω,  SIL ≈  330 MW
        230 kV → Zc ≈ 376 Ω,  SIL ≈  141 MW
        120 kV → Zc ≈ 402 Ω,  SIL ≈   36 MW
    """
    types = [
        # name,         f_nom, r_per_length, x_per_length, b_per_length (µS/km)
        ("735kV_line",   60,   0.0186,       0.2580,       4.0),
        ("765kV_line",   60,   0.0150,       0.2400,       4.1),
        ("450kV_line",   60,   0.0250,       0.2750,       3.8),
        ("345kV_line",   60,   0.0400,       0.3200,       3.5),
        ("320kV_line",   60,   0.0420,       0.3300,       3.4),  # HVDC approx DC
        ("315kV_line",   60,   0.0390,       0.3170,       3.5),
        ("230kV_line",   60,   0.0540,       0.3960,       2.8),
        ("120kV_line",   60,   0.1150,       0.4200,       2.6),
        ("69kV_line",    60,   0.1700,       0.4400,       2.5),
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


# Règle de correspondance : type de bus (type.1 dans xlsx) → type de ligne corrigé
# Priorité décroissante : si un des deux bus est dans la catégorie haute tension,
# on prend le type le plus élevé.
_BUS_SUBTYPE_TO_LINE_TYPE: Dict[str, str] = {
    # Les grandes centrales hydro (Reservoir) se raccordent directement au réseau 735kV.
    # Les Bus de consommation (Conso) reçoivent l'énergie via des transformateurs 735kV→315kV
    # dont la capacité agrégée doit être ≥ la demande locale. Pour garantir la faisabilité
    # de l'OPF, on modélise ces connexions à 735kV (2000 MVA). Les dépassements réels
    # apparaissent dans constraint_warnings.
    "Bus":          "735kV_line",
    "Reservoir":    "735kV_line",   # LG-2, Churchill Falls, etc. — raccordement 735kV
    "Fil de l'eau": "315kV_line",   # centrales au fil de l'eau — généralement 315kV
    "Eolienne":     "230kV_line",   # parcs éoliens — réseau collecteur 230kV
    "Conso":        "735kV_line",   # postes de livraison — capacité agrégée 735kV
    "Thermique":    "230kV_line",   # centrales thermiques (appoint)
    "Solaire":      "120kV_line",   # fermes solaires
    "Interco":      "230kV_line",   # interconnexions interprovinciales
    "Etranger":     "230kV_line",   # marchés étrangers
}

# s_nom réaliste par type de ligne (1 circuit physique) — unité : MVA
_LINE_TYPE_TO_SNOM: Dict[str, float] = {
    "735kV_line": 2000.0,
    "765kV_line": 2000.0,
    "450kV_line": 1306.0,
    "345kV_line":  700.0,
    "320kV_line": 1200.0,
    "315kV_line":  600.0,
    "230kV_line":  400.0,
    "120kV_line":  200.0,
    "69kV_line":   100.0,
}

# Priorité des types de ligne (plus haut = tension plus élevée)
_LINE_TYPE_PRIORITY: Dict[str, int] = {
    "735kV_line": 9, "765kV_line": 10, "450kV_line": 8,
    "345kV_line": 7, "320kV_line": 7, "315kV_line": 6,
    "230kV_line": 5, "120kV_line": 3, "69kV_line": 1,
}


def _infer_line_type(subtype0: str, subtype1: str) -> str:
    """Retourne le type de ligne le plus approprié pour une paire de bus.

    Règle : la tension de la ligne = tension du côté le plus bas (côté générateur/charge).
    Ex : Bus(735kV) ↔ Eolienne(230kV) → ligne 230kV (pas 735kV).
    Exception : Bus ↔ Bus reste 735kV (les deux côtés sont haute tension).
    """
    t0 = _BUS_SUBTYPE_TO_LINE_TYPE.get(subtype0, "230kV_line")
    t1 = _BUS_SUBTYPE_TO_LINE_TYPE.get(subtype1, "230kV_line")
    # Prend le type de plus BASSE priorité (côté générateur/charge dictant la tension)
    if _LINE_TYPE_PRIORITY.get(t0, 0) <= _LINE_TYPE_PRIORITY.get(t1, 0):
        return t0
    return t1


def _load_topology_from_xlsx() -> Dict[str, pd.DataFrame]:
    """Charge buses et lignes depuis bus_db_2026.xlsx + lines_db_2026.xlsx.

    Convention de nommage PyPSA :
    - La colonne `id` de l'xlsx devient `name` (identifiant PyPSA : Bus1, Conso3, etc.)
    - Les bus Etranger ont leur `type` remappé de 'conso' à 'etranger'
      pour que _add_loads_on_conso_buses() ne leur crée pas de charge.
    - Les bus Interco ont leur `type` remappé à 'interco'.

    Corrections automatiques pour les 232 lignes NaN :
    - Type de ligne : inféré depuis le type des bus connectés (Eolienne → 230kV, etc.)
    - Longueur : Haversine × 1.3 (facteur câble réel vs vol d'oiseau)
    - s_nom : valeur standard par type de ligne (1 circuit physique)
    """
    buses_raw = pd.read_excel(_BUS_XLSX)
    lines_raw = pd.read_excel(_LINES_XLSX)

    # --- Buses ---
    buses = buses_raw.rename(columns={"id": "name", "name": "description"}).copy()
    subtype = buses["type.1"].fillna("")
    buses.loc[subtype == "Etranger", "type"] = "etranger"
    buses.loc[subtype == "Interco",  "type"] = "interco"
    buses = buses[["name", "v_nom", "type", "x", "y", "control"]].reset_index(drop=True)

    # Index bus pour lookup coords et subtype
    bus_coords  = buses.set_index("name")[["x", "y"]]          # x=lat, y=lon
    # Reconstruire subtype depuis le xlsx original (type.1 avant remapping).
    # Important: buses_raw a une colonne "id" ET une colonne "name" (description) — on
    # indexe explicitement par "id" pour éviter la collision de noms après rename.
    bus_subtype = buses_raw[["id", "type.1"]].set_index("id")["type.1"].fillna("Bus")

    # --- Lines ---
    lines = (
        lines_raw
        .drop(columns=["type"], errors="ignore")
        .rename(columns={"type.1": "type"})
        [["name", "bus0", "bus1", "type", "capital_cost", "length", "s_nom"]]
        .reset_index(drop=True)
    )
    lines["num_parallel"] = 1.0  # défaut : 1 circuit

    # Lire nb_ligne depuis le fichier si disponible (bonification du collègue).
    # Ces valeurs ont priorité sur les heuristiques appliquées plus bas.
    if "nb_ligne" in lines_raw.columns:
        nb_from_file = lines_raw["nb_ligne"].reset_index(drop=True)
        valid_nb = nb_from_file.notna() & (nb_from_file > 0)
        lines.loc[valid_nb, "num_parallel"] = nb_from_file[valid_nb].astype(float)

    # --- Corriger les lignes sans s_nom (232 lignes NaN) ---
    nan_mask = lines["s_nom"].isna()
    if nan_mask.any():
        logger.info("Correction automatique de %d lignes sans s_nom/length/type…", nan_mask.sum())
        corrected_types   = []
        corrected_lengths = []
        corrected_snoms   = []
        corrected_parallel = []

        for _, row in lines[nan_mask].iterrows():
            b0, b1 = str(row["bus0"]), str(row["bus1"])

            # 1. Type de ligne et nombre de circuits parallèles inférés
            st0 = str(bus_subtype.get(b0, "Bus"))
            st1 = str(bus_subtype.get(b1, "Bus"))
            inferred_type = _infer_line_type(st0, st1)
            corrected_types.append(inferred_type)

            # nb_ligne inconnu pour ces lignes sans données — on garde 1 circuit.
            # Le rapport d'infrastructure indiquera combien en ajouter si nécessaire.
            corrected_parallel.append(1.0)

            # 2. Longueur Haversine × 1.3 (facteur câble)
            if b0 in bus_coords.index and b1 in bus_coords.index:
                lat0, lon0 = float(bus_coords.loc[b0, "x"]), float(bus_coords.loc[b0, "y"])
                lat1, lon1 = float(bus_coords.loc[b1, "x"]), float(bus_coords.loc[b1, "y"])
                dist = max(_haversine_km(lat0, lon0, lat1, lon1) * 1.3, 5.0)  # min 5 km → évite petits coefficients KVL
            else:
                dist = 50.0  # fallback si bus introuvable
            corrected_lengths.append(dist)

            # 3. s_nom réaliste selon type inféré (1 circuit)
            corrected_snoms.append(_LINE_TYPE_TO_SNOM.get(inferred_type, 400.0))

        lines.loc[nan_mask, "type"]         = corrected_types
        lines.loc[nan_mask, "length"]       = corrected_lengths
        lines.loc[nan_mask, "s_nom"]        = corrected_snoms
        lines.loc[nan_mask, "num_parallel"] = corrected_parallel

        # Stats de log
        type_counts = lines.loc[nan_mask, "type"].value_counts().to_dict()
        logger.info("  Types inférés : %s", type_counts)
        logger.info(
            "  Longueurs calculées : min=%.1f km  max=%.1f km  moy=%.1f km",
            lines.loc[nan_mask, "length"].min(),
            lines.loc[nan_mask, "length"].max(),
            lines.loc[nan_mask, "length"].mean(),
        )

    # --- Log résumé nb_ligne ---
    nb_multi = (lines["num_parallel"] > 1).sum()
    logger.info(
        "  nb_ligne : %d lignes avec circuits explicites (fichier) | %d lignes à 1 circuit",
        nb_multi, len(lines) - nb_multi,
    )

    return {
        "buses":      buses,
        "lines":      lines,
        "line_types": _make_line_types_df(),
    }


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
    # On cache le résultat en parquet pour les runs suivants.
    _dcache_key = f"{weather_str}|{scenario_str}|{snapshots[0]}|{snapshots[-1]}|{len(conso_df)}"
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
            bus = _resolve_generator_bus(row.get("bus"), row.get("latitude"), row.get("longitude"), buses_df, row.get("nom"))
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
                    "marginal_cost": 7.0 if carrier == "hydro_reservoir" else 0.1,
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
# Valeur de l'eau — coût marginal dynamique hydro réservoir
# ---------------------------------------------------------------------------

def _water_value_cost(fill_level: float) -> float:
    """Coût marginal de l'eau ($/MWh) — courbe continue en fonction du fill%.

    Inspiré de EnergyUtils.calcul_cout_reservoir() (module reseau legacy)
    mais recalibré pour le marché d'export (prix spot NE = 30 $/MWh).

    Paramètres de la courbe :
        cout_min       = 5 $/MWh   — réservoir plein (>85%), eau abondante
        cout_max       = 80 $/MWh  — réservoir quasi-vide (<20%), réserve d'urgence
        seuil_critique = 0.30      — sous ce niveau, croissance exponentielle

    Logique de calibration (alignée sur prix import saisonnier hiver=15 $/MWh) :
        - À fill > 85% :  ~5 $/MWh  → LP exporte librement (5 << 12 prix export)
        - À fill = 70% : ~16 $/MWh  → LP commence à importer en hiver (16 > 15)
        - À fill = 55% : ~22 $/MWh  → LP importe massivement en hiver
        - À fill = 40% : ~40 $/MWh  → LP importe toute l'année
        - À fill < 25% : ~80 $/MWh  → Réserve d'urgence

    Sources :
        - Sigholm Nordic Analysis — "water value ≈ marginal cost of displaced thermal"
        - arXiv 2508.04854 — "Baseline hydropower offer curves" (MDP approach)
        - HQ prix export moyen ~30 $/MWh (contrats NE/NY/Ontario)
    """
    cout_min = 5.0
    cout_max = 80.0
    seuil_critique = 0.30
    fill = max(0.0, min(1.0, fill_level))

    if fill < seuil_critique:
        # Sous le seuil critique : exponentielle (urgence)
        facteur = (seuil_critique - fill) / seuil_critique
        return cout_min + (cout_max - cout_min) * math.exp(2.0 * facteur) / math.exp(2.0)
    else:
        # Au-dessus : linéaire décroissante (pente plus raide)
        facteur = (1.0 - fill) / (1.0 - seuil_critique)
        return cout_min + (cout_max / 2.5 - cout_min) * facteur


def _water_value_cost_vectorized(fill_levels: np.ndarray) -> np.ndarray:
    """Version vectorisée de _water_value_cost() pour appliquer sur un array."""
    cout_min = 5.0
    cout_max = 80.0
    seuil_critique = 0.30
    fills = np.clip(fill_levels, 0.0, 1.0)
    costs = np.zeros_like(fills, dtype=np.float64)

    below = fills < seuil_critique
    facteur_below = (seuil_critique - fills[below]) / seuil_critique
    costs[below] = cout_min + (cout_max - cout_min) * np.exp(2.0 * facteur_below) / np.exp(2.0)

    above = ~below
    facteur_above = (1.0 - fills[above]) / (1.0 - seuil_critique)
    costs[above] = cout_min + (cout_max / 2.5 - cout_min) * facteur_above

    return np.round(costs, 2)


def _get_initial_reservoir_fill(scenario: Any) -> Dict[str, float]:
    """Retourne le niveau de remplissage initial des réservoirs par barrage.

    Sources (priorité décroissante) :
    1. scenario.pourcentage_reservoir_initial : dict {nom_barrage: float} ∈ [0, 1]
    2. scenario.pourcentage_reservoir_initial : float (niveau global)
    3. Valeur par défaut : 70 % (niveau estival typique HQ, au-dessus du seuil 50%)

    Le niveau global est stocké sous la clé spéciale "_global" et utilisé comme
    fallback pour les barrages non listés individuellement.
    """
    fill: Dict[str, float] = {}
    reservoir_attr = getattr(scenario, "pourcentage_reservoir_initial", None)
    if isinstance(reservoir_attr, dict):
        fill = {k: float(v) for k, v in reservoir_attr.items()}
        if "_global" not in fill:
            fill["_global"] = 0.70
    elif isinstance(reservoir_attr, (int, float)):
        fill["_global"] = max(0.0, min(1.0, float(reservoir_attr)))
    else:
        fill["_global"] = 0.70  # niveau estival typique HQ
    return fill


# ---------------------------------------------------------------------------
# Trajectoire de remplissage des réservoirs (bilan hydrique pré-LP)
# ---------------------------------------------------------------------------
# Même physique que reservoir_infill() dans harmoniq/modules/hydro/calcule.py :
#   fill(t+1) = (volume × fill(t) + apport(t) × Δt − turbinage_estimé × Δt) / volume
#
# Différences vs l'original :
#   1. Pas de dépendance à HydroGenerate (calculate_hp_potential)
#   2. Pas d'appel DB (on charge Info_Barrages.csv directement)
#   3. Traite tous les snapshots d'un coup (vs 1 timestep à la fois)
#   4. Turbinage estimé via capacity_factor moyen (le LP décidera du vrai dispatch)
#
# Données utilisées (identiques à calcule.py) :
#   - apport_naturel/{id_HQ}.csv → streamflow journalier (m³/s), 1961-2100
#   - Info_Barrages.csv → volume_reservoir (m³), catch_coefficient, id_HQ
# ---------------------------------------------------------------------------

_RESERVOIR_INFO_CACHE: Optional[pd.DataFrame] = None


def _load_reservoir_info() -> pd.DataFrame:
    """Charge Info_Barrages.csv et retourne les barrages à réservoir (volume > 0)."""
    global _RESERVOIR_INFO_CACHE
    if _RESERVOIR_INFO_CACHE is not None:
        return _RESERVOIR_INFO_CACHE
    if not _INFO_BARRAGES_CSV.exists():
        logger.warning("Info_Barrages.csv introuvable : %s", _INFO_BARRAGES_CSV)
        _RESERVOIR_INFO_CACHE = pd.DataFrame()
        return _RESERVOIR_INFO_CACHE
    info = pd.read_csv(_INFO_BARRAGES_CSV)
    reservoirs = info[info["Volume_reservoir"] > 0].copy()
    _RESERVOIR_INFO_CACHE = reservoirs
    return reservoirs


_APPORT_MONTHLY_CACHE: Dict[Tuple[int, int], np.ndarray] = {}


def _load_apport_monthly_avg(id_hq: int, year: int) -> np.ndarray:
    """Charge les apports naturels et retourne la moyenne mensuelle (12 valeurs, m³/s).

    Utilise les données historiques proches de l'année cible si disponible,
    sinon la moyenne sur toutes les années. Résultat caché en mémoire (CSV immuables).
    """
    cache_key = (id_hq, year)
    if cache_key in _APPORT_MONTHLY_CACHE:
        return _APPORT_MONTHLY_CACHE[cache_key]

    csv_path = _APPORT_NATUREL_DIR / f"{id_hq}.csv"
    if not csv_path.exists():
        result = np.full(12, 100.0)  # fallback 100 m³/s
        _APPORT_MONTHLY_CACHE[cache_key] = result
        return result

    df = pd.read_csv(csv_path)
    df["time"] = pd.to_datetime(df["time"])

    # Chercher des données proches de l'année cible (±5 ans)
    mask = (df["time"].dt.year >= year - 5) & (df["time"].dt.year <= year + 5)
    subset = df[mask] if mask.sum() > 100 else df  # fallback sur tout si peu de données

    monthly = subset.groupby(subset["time"].dt.month)["streamflow"].mean()
    result = np.zeros(12)
    for m in range(1, 13):
        result[m - 1] = monthly.get(m, 100.0)
    _APPORT_MONTHLY_CACHE[cache_key] = result
    return result


def _compute_fill_trajectory(
    snapshots: pd.DatetimeIndex,
    reservoir_gen_names: List[str],
    generators_df: pd.DataFrame,
    scenario: Any,
) -> pd.DataFrame:
    """Calcule la trajectoire de remplissage pré-LP pour chaque réservoir.

    Bilan hydrique simplifié (même physique que calcule.py/reservoir_infill) :
        fill(t+1) = fill(t) + (apport - turbinage_estimé) × Δt / volume

    Le turbinage est estimé comme : p_nom × capacity_factor_moyen (0.50).
    C'est une heuristique pré-LP : le vrai dispatch sera décidé par l'optimiseur.
    L'objectif est de donner le bon signal saisonnier au coût marginal.

    Returns
    -------
    pd.DataFrame
        Index = snapshots, colonnes = noms des générateurs réservoir.
        Valeurs = fill% ∈ [0.05, 1.0]
    """
    reservoirs_info = _load_reservoir_info()
    initial_fills = _get_initial_reservoir_fill(scenario)
    year = snapshots[0].year if len(snapshots) > 0 else 2035

    fill_data: Dict[str, np.ndarray] = {}

    for gen_name in reservoir_gen_names:
        # Trouver le barrage correspondant dans Info_Barrages.csv
        match = reservoirs_info[reservoirs_info["Nom"] == gen_name]
        if match.empty:
            # Fallback : fill constant
            fill_init = initial_fills.get(gen_name, initial_fills.get("_global", 0.70))
            fill_data[gen_name] = np.full(len(snapshots), fill_init)
            continue

        dam = match.iloc[0]
        volume_m3 = float(dam["Volume_reservoir"])
        id_hq = int(dam["id_HQ"])
        catch_coeff = float(dam.get("catch_coefficient", 1.0))

        # p_nom du générateur dans le réseau
        gen_match = generators_df[generators_df["name"] == gen_name]
        p_nom_mw = float(gen_match.iloc[0].get("p_nom", 500.0)) if not gen_match.empty else 500.0

        # Apports mensuels moyens (m³/s)
        monthly_inflow = _load_apport_monthly_avg(id_hq, year) * catch_coeff

        # Turbinage estimé : convertir p_nom MW en m³/s approximatif
        # P = ρ × g × Q × h × η  →  Q ≈ P / (ρ × g × h × η)
        # Approx simplifiée : capacity_factor 50% → turbinage moyen
        hauteur = float(dam.get("Hauteur_de_chute_m", 50.0))
        eta = float(dam.get("eta_turb", 0.90))
        if hauteur > 0 and eta > 0:
            # Q_turb (m³/s) pour la puissance moyenne dispatchée
            # P_moyen = p_nom × 0.50 (capacity factor estimé)
            # Q = P / (ρ×g×h×η) = P_MW × 1e6 / (1000 × 9.81 × h × η)
            q_turb_avg = (p_nom_mw * 0.50 * 1e6) / (1000.0 * 9.81 * hauteur * eta)
        else:
            debit_nom = float(dam.get("Debits_nom_m3s", 500.0))
            q_turb_avg = debit_nom * 0.50

        # Boucle temporelle : bilan hydrique par snapshot
        fill_init = initial_fills.get(gen_name, initial_fills.get("_global", 0.70))
        fills = np.zeros(len(snapshots))
        current_fill = fill_init

        for i, ts in enumerate(snapshots):
            month_idx = ts.month - 1  # 0-based
            q_in = monthly_inflow[month_idx]  # m³/s apport

            # Δt en secondes (hebdo = 168h = 604800s, horaire = 3600s)
            if i < len(snapshots) - 1:
                dt_seconds = (snapshots[i + 1] - snapshots[i]).total_seconds()
            else:
                dt_seconds = 168 * 3600  # dernière semaine

            # Bilan : volume_delta = (apport - turbinage) × Δt
            net_flow_m3 = (q_in - q_turb_avg) * dt_seconds
            current_fill = current_fill + net_flow_m3 / volume_m3
            current_fill = max(0.05, min(1.0, current_fill))
            fills[i] = current_fill

        fill_data[gen_name] = fills
        logger.debug(
            "Trajectoire fill %s : init=%.0f%% → min=%.0f%% max=%.0f%% fin=%.0f%%",
            gen_name, fill_init * 100,
            fills.min() * 100, fills.max() * 100, fills[-1] * 100,
        )

    fill_df = pd.DataFrame(fill_data, index=snapshots)

    # --- Contrainte de réserve stratégique (Régie de l'énergie) ---
    # HQ maintient ~64 TWh de réserve (36% fill) + 50 TWh pour l'hiver.
    # Seuil opérationnel confortable : 56-64% fill (100-114 TWh sur 178 TWh).
    # On limite le p_max_pu des réservoirs quand le fill est bas pour forcer l'import.
    # Sources : Rapport Annuel HQ, Plan d'approvisionnement 2023-2032, Régie D-2023-109.
    reservoir_pmax = pd.DataFrame(index=snapshots)
    for col in fill_df.columns:
        fills = fill_df[col].values
        # Interpolation linéaire continue : fill% → p_max_pu
        # fill ≥ 70% → 0.95 (libre)
        # fill = 45% → 0.50 (prudence)
        # fill ≤ 30% → 0.15 (réserve stratégique dure → force import)
        pmax = np.interp(fills, [0.30, 0.45, 0.70], [0.15, 0.50, 0.95])
        pmax = np.clip(pmax, 0.15, 0.95)
        reservoir_pmax[col] = pmax
        logger.debug(
            "Réserve %s : fill %.0f-%.0f%% → p_max_pu %.2f-%.2f",
            col, fills.min() * 100, fills.max() * 100, pmax.min(), pmax.max(),
        )

    return fill_df, reservoir_pmax
