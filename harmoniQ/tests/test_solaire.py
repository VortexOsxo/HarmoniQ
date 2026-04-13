"""
Tests unitaires pour le module solaire (calculate_energy_solar_plants).

Les tests mockent l'API PVGIS pour fonctionner sans connexion internet.

Exécution visuelle directe (appel PVGIS réel) :
    python tests/test_solaire.py
"""
import numpy as np
import pandas as pd
import pytest

from harmoniq.modules.solaire.calculs_production_solaire import (
    calculate_energy_solar_plants,
    calculate_base_production_per_m2,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_tmy() -> pd.DataFrame:
    """Crée un profil TMY synthétique de 8760 heures utilisable par pvlib."""
    index = pd.date_range("2020-01-01", periods=8760, freq="h", tz="UTC")
    hours = index.hour.to_numpy()

    # Irradiance diurne en UTC : pic à 17h UTC = midi local Québec (UTC-5)
    # Non nulle de 11h à 23h UTC (= 6h à 18h heure locale)
    ghi = np.maximum(0.0, np.sin((hours - 11) * np.pi / 12) * 600.0)
    dhi = ghi * 0.15
    dni = ghi * 0.85

    return pd.DataFrame(
        {
            "temp_air": np.full(8760, 10.0),
            "wind_speed": np.full(8760, 3.0),
            "ghi": ghi,
            "dhi": dhi,
            "dni": dni,
        },
        index=index,
    )


# ---------------------------------------------------------------------------
# Fixture : mock de get_pvgis_tmy (évite tout appel réseau)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_pvgis(monkeypatch):
    tmy = _make_fake_tmy()
    monkeypatch.setattr(
        "pvlib.iotools.get_pvgis_tmy",
        lambda lat, lon, **kwargs: (tmy, None),
    )
    return tmy


# ---------------------------------------------------------------------------
# Paramètres communs
# ---------------------------------------------------------------------------

PARAMS = dict(
    nom="Test",
    latitude=45.5,
    longitude=-73.5,
    angle_panneau=30.0,
    orientation_panneau=180.0,
    nombre_panneau=100,
    date_start=pd.Timestamp("2035-01-01"),
    date_end=pd.Timestamp("2035-12-31 23:00:00"),
)


# ---------------------------------------------------------------------------
# Tests de structure du DataFrame retourné
# ---------------------------------------------------------------------------

def test_retourne_un_dataframe(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert isinstance(df, pd.DataFrame)


def test_colonnes_presentes(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert {"date", "nom", "Latitude", "Longitude", "production"}.issubset(df.columns)


def test_colonne_nom_correcte(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert (df["nom"] == "Test").all()


def test_colonne_latitude_correcte(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert (df["Latitude"] == 45.5).all()


def test_colonne_longitude_correcte(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert (df["Longitude"] == -73.5).all()


# ---------------------------------------------------------------------------
# Tests sur la longueur du DataFrame (couverture temporelle)
# ---------------------------------------------------------------------------

def test_longueur_une_annee(mock_pvgis):
    """365 jours × 24h = 8 760 lignes pour 2035."""
    df = calculate_energy_solar_plants(**PARAMS)
    expected = len(pd.date_range("2035-01-01", "2035-12-31 23:00:00", freq="h"))
    assert len(df) == expected


def test_longueur_multi_annees(mock_pvgis):
    """Vérifie que le profil TMY est bien répété sur plusieurs années."""
    p = {**PARAMS, "date_end": pd.Timestamp("2037-12-31 23:00:00")}
    df = calculate_energy_solar_plants(**p)
    expected = len(pd.date_range("2035-01-01", "2037-12-31 23:00:00", freq="h"))
    assert len(df) == expected


def test_longueur_periode_courte(mock_pvgis):
    """Période inférieure à 8760h (1 mois)."""
    p = {**PARAMS, "date_end": pd.Timestamp("2035-01-31 23:00:00")}
    df = calculate_energy_solar_plants(**p)
    expected = len(pd.date_range("2035-01-01", "2035-01-31 23:00:00", freq="h"))
    assert len(df) == expected


# ---------------------------------------------------------------------------
# Tests sur la production
# ---------------------------------------------------------------------------

def test_production_non_negative(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS)
    assert (df["production"] >= 0).all()


def test_production_positive_en_journee(mock_pvgis):
    """Il doit y avoir de la production à midi en été."""
    df = calculate_energy_solar_plants(**PARAMS)
    df["heure"] = pd.to_datetime(df["date"]).dt.hour
    production_midi = df[df["heure"] == 12]["production"]
    assert production_midi.max() > 0


def test_production_nulle_la_nuit(mock_pvgis):
    """La production doit être nulle à 3h du matin (irradiance = 0 dans le mock)."""
    df = calculate_energy_solar_plants(**PARAMS)
    df["heure"] = pd.to_datetime(df["date"]).dt.hour
    production_nuit = df[df["heure"] == 3]["production"]
    assert (production_nuit == 0).all()


def test_plus_de_panneaux_plus_de_production(mock_pvgis):
    """Doubler le nombre de panneaux doit doubler la production totale."""
    df_petit = calculate_energy_solar_plants(**PARAMS)
    p_grand = {**PARAMS, "nombre_panneau": PARAMS["nombre_panneau"] * 2}
    df_grand = calculate_energy_solar_plants(**p_grand)
    ratio = df_grand["production"].sum() / df_petit["production"].sum()
    assert abs(ratio - 2.0) < 0.01



# ---------------------------------------------------------------------------
# Coordonnées de test (3 MRCs fictives)
# ---------------------------------------------------------------------------

COORDS_MRC_TEST = [
    (45.5, -73.5, "MRC_A", 0, "Etc/GMT+5"),
    (46.0, -73.0, "MRC_B", 0, "Etc/GMT+5"),
    (47.0, -71.5, "MRC_C", 0, "Etc/GMT+5"),
]


# ---------------------------------------------------------------------------
# Tests — calculate_base_production_per_m2
# ---------------------------------------------------------------------------

def test_base_retourne_dataframe(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert isinstance(df, pd.DataFrame)


def test_base_colonnes(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert {"datetime", "mrc", "production_w_per_m2"}.issubset(df.columns)


def test_base_longueur(mock_pvgis):
    """8760 lignes par MRC."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert len(df) == 3 * 8760


def test_base_nb_mrc(mock_pvgis):
    """Autant de MRCs uniques que de coordonnées passées."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert df["mrc"].nunique() == 3


def test_base_noms_mrc_corrects(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert set(df["mrc"].unique()) == {"MRC_A", "MRC_B", "MRC_C"}


def test_base_non_negative(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert (df["production_w_per_m2"] >= 0).all()


def test_base_production_positive_en_journee(mock_pvgis):
    """Il doit y avoir de la production à midi (heure locale)."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST[:1])
    df["heure"] = pd.to_datetime(df["datetime"]).dt.hour
    assert df[df["heure"] == 12]["production_w_per_m2"].max() > 0


def test_base_production_nulle_la_nuit(mock_pvgis):
    """Pas de production à 3h du matin."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST[:1])
    df["heure"] = pd.to_datetime(df["datetime"]).dt.hour
    assert (df[df["heure"] == 3]["production_w_per_m2"] == 0).all()


def test_base_valeurs_raisonnables(mock_pvgis):
    """W/m² doit rester dans une plage physiquement plausible (0–300 W/m²)."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert df["production_w_per_m2"].max() < 300


def test_base_pas_de_nan(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    assert not df.isnull().any().any()


def test_base_datetime_parseable(mock_pvgis):
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    dates = pd.to_datetime(df["datetime"], errors="coerce")
    assert dates.notna().all()


def test_base_csv_export(mock_pvgis, tmp_path):
    """Le CSV exporté a les bonnes colonnes et le bon nombre de lignes."""
    df = calculate_base_production_per_m2(COORDS_MRC_TEST)
    path = tmp_path / "base_production_mrc.csv"
    df.to_csv(path, index=False)
    df_lu = pd.read_csv(path)
    assert {"datetime", "mrc", "production_w_per_m2"}.issubset(df_lu.columns)
    assert len(df_lu) == 3 * 8760


# ---------------------------------------------------------------------------
# Tests bifacial
# ---------------------------------------------------------------------------

def test_bifacial_gain_positif(mock_pvgis):
    """Le mode bifacial doit produire plus que le monofacial."""
    df_mono = calculate_energy_solar_plants(**PARAMS, bifacial=False)
    df_bi   = calculate_energy_solar_plants(**PARAMS, bifacial=True)
    assert df_bi["production"].sum() > df_mono["production"].sum()


def test_bifacial_non_negative(mock_pvgis):
    df = calculate_energy_solar_plants(**PARAMS, bifacial=True)
    assert (df["production"] >= 0).all()


def test_bifacial_gain_raisonnable(mock_pvgis):
    """Gain bifacial attendu entre 1 % et 25 %."""
    df_mono = calculate_energy_solar_plants(**PARAMS, bifacial=False)
    df_bi   = calculate_energy_solar_plants(**PARAMS, bifacial=True)
    gain = (df_bi["production"].sum() - df_mono["production"].sum()) / df_mono["production"].sum()
    assert 0.01 < gain < 0.25


# ---------------------------------------------------------------------------
# Tests d'intégration (appellent l'API PVGIS réelle — nécessitent internet)
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_integration_une_annee_reelle():
    """Appel PVGIS réel pour La Prairie — vérifie la structure du résultat."""
    df = calculate_energy_solar_plants(
        nom="La Prairie",
        latitude=45.4167,
        longitude=-73.4999,
        angle_panneau=30.0,
        orientation_panneau=180.0,
        nombre_panneau=1000,
        date_start=pd.Timestamp("2035-01-01"),
        date_end=pd.Timestamp("2035-12-31 23:00:00"),
    )
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 8760
    assert (df["production"] >= 0).all()
    assert df["production"].sum() > 0


# ---------------------------------------------------------------------------
# Affichage visuel (python tests/test_solaire.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import matplotlib.pyplot as plt

    CENTRALES = [
        dict(nom="La Prairie",  latitude=45.4167, longitude=-73.4999, nombre_panneau=26000),
        dict(nom="Varennes",    latitude=45.6833, longitude=-73.4333, nombre_panneau=8500),
    ]
    COMMUN = dict(
        angle_panneau=30.0,
        orientation_panneau=180.0,
        date_start=pd.Timestamp("2035-01-01"),
        date_end=pd.Timestamp("2035-12-31 23:00:00"),
    )

    resultats = {}
    for c in CENTRALES:
        print(f"\n>> Calcul de {c['nom']} (appel PVGIS)...")
        df = calculate_energy_solar_plants(**c, **COMMUN)
        resultats[c["nom"]] = df

        total_gwh = df["production"].sum() / 1_000_000
        max_kw    = df["production"].max()
        print(f"  Lignes        : {len(df)}")
        print(f"  Production ann. : {total_gwh:.2f} GWh")
        print(f"  Pic max       : {max_kw:,.0f} kW")
        print(df.head(6).to_string(index=False))

    # ── Graphique 0 : comparaison albédo saisonnier vs défaut ────────────────
    c_ref = CENTRALES[0]  # La Prairie uniquement (1 seul appel supplémentaire)
    print(f"\n>> Calcul albedo fixe (reference) pour {c_ref['nom']}...")
    df_sans = calculate_energy_solar_plants(**c_ref, **COMMUN, albedo_saisonnier=False)
    df_avec = resultats[c_ref["nom"]]  # déjà calculé avec albedo_saisonnier=True

    df_sans["mois"] = pd.to_datetime(df_sans["date"]).dt.month
    df_avec["mois"] = pd.to_datetime(df_avec["date"]).dt.month
    mensuel_sans = df_sans.groupby("mois")["production"].sum() / 1_000   # MWh
    mensuel_avec = df_avec.groupby("mois")["production"].sum() / 1_000
    gain_pct     = (mensuel_avec - mensuel_sans) / mensuel_sans * 100

    MOIS_L = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aou","Sep","Oct","Nov","Dec"]
    x = np.arange(12)

    fig0, ax_bar = plt.subplots(figsize=(13, 5))
    ax_pct = ax_bar.twinx()

    ax_bar.bar(x - 0.18, mensuel_sans.values, 0.35, label="Albedo fixe (0.25)", color="#90c3e8", alpha=0.85)
    ax_bar.bar(x + 0.18, mensuel_avec.values, 0.35, label="Albedo saisonnier",  color="#f4a261", alpha=0.85)
    ax_pct.plot(x, gain_pct.values, "o-", color="#2a9d8f", linewidth=2, label="Gain (%)")
    ax_pct.axhline(0, color="grey", linewidth=0.8, linestyle="--")

    ax_bar.set_xticks(x)
    ax_bar.set_xticklabels(MOIS_L)
    ax_bar.set_ylabel("Production mensuelle (MWh)")
    ax_pct.set_ylabel("Gain albedo saisonnier (%)", color="#2a9d8f")
    ax_pct.tick_params(axis="y", colors="#2a9d8f")
    ax_bar.set_title(f"{c_ref['nom']} — Impact albedo saisonnier vs fixe (2035)")

    lines1, labels1 = ax_bar.get_legend_handles_labels()
    lines2, labels2 = ax_pct.get_legend_handles_labels()
    ax_bar.legend(lines1 + lines2, labels1 + labels2, loc="upper right")
    ax_bar.grid(axis="y", alpha=0.3)

    total_gain = (df_avec["production"].sum() - df_sans["production"].sum()) / df_sans["production"].sum() * 100
    print(f"  Gain annuel albedo saisonnier : +{total_gain:.2f}%")

    plt.tight_layout()
    plt.savefig("albedo_comparaison.png", dpi=120)
    print("[OK] albedo_comparaison.png sauvegarde")

    # ── Graphique bifacial : mono vs bifacial (La Prairie) ───────────────────
    print(f"\n>> Calcul mono/bifacial pour {c_ref['nom']}...")
    df_mono = calculate_energy_solar_plants(**c_ref, **COMMUN, bifacial=False)
    df_bi   = calculate_energy_solar_plants(**c_ref, **COMMUN, bifacial=True)
    df_mono["mois"] = pd.to_datetime(df_mono["date"]).dt.month
    df_bi["mois"]   = pd.to_datetime(df_bi["date"]).dt.month
    m_mono = df_mono.groupby("mois")["production"].sum() / 1_000   # MWh
    m_bi   = df_bi.groupby("mois")["production"].sum()   / 1_000
    gain_bi_pct = (m_bi - m_mono) / m_mono * 100

    fig_bi, ax_bi = plt.subplots(figsize=(13, 5))
    ax_pct_bi = ax_bi.twinx()

    ax_bi.bar(x - 0.18, m_mono.values, 0.35, label="Monofacial", color="#90c3e8", alpha=0.85)
    ax_bi.bar(x + 0.18, m_bi.values,   0.35, label="Bifacial (facteur=0.70)", color="#e76f51", alpha=0.85)
    ax_pct_bi.plot(x, gain_bi_pct.values, "o-", color="#264653", linewidth=2, label="Gain bifacial (%)")
    ax_pct_bi.axhline(0, color="grey", linewidth=0.8, linestyle="--")

    ax_bi.set_xticks(x)
    ax_bi.set_xticklabels(MOIS_L)
    ax_bi.set_ylabel("Production mensuelle (MWh)")
    ax_pct_bi.set_ylabel("Gain bifacial (%)", color="#264653")
    ax_pct_bi.tick_params(axis="y", colors="#264653")
    ax_bi.set_title(f"{c_ref['nom']} — Monofacial vs Bifacial (albedo saisonnier, 2035)")

    lines1, labels1 = ax_bi.get_legend_handles_labels()
    lines2, labels2 = ax_pct_bi.get_legend_handles_labels()
    ax_bi.legend(lines1 + lines2, labels1 + labels2, loc="upper right")
    ax_bi.grid(axis="y", alpha=0.3)

    gain_annuel_bi = (df_bi["production"].sum() - df_mono["production"].sum()) / df_mono["production"].sum() * 100
    print(f"  Gain annuel bifacial : +{gain_annuel_bi:.2f}%")

    plt.tight_layout()
    plt.savefig("bifacial_comparaison.png", dpi=120)
    print("[OK] bifacial_comparaison.png sauvegarde")

    # ── Graphique 1 : production horaire sur janvier ──────────────────────
    fig, axes = plt.subplots(len(CENTRALES), 1, figsize=(14, 5 * len(CENTRALES)), sharex=False)
    if len(CENTRALES) == 1:
        axes = [axes]

    for ax, (nom, df) in zip(axes, resultats.items()):
        janvier = df[pd.to_datetime(df["date"]).dt.month == 1]
        ax.fill_between(pd.to_datetime(janvier["date"]), janvier["production"], alpha=0.7)
        ax.set_title(f"{nom} — Production horaire (janvier 2035)", fontsize=13)
        ax.set_ylabel("Production (kW)")
        ax.set_xlabel("Date")
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("production_janvier.png", dpi=120)
    print("\n[OK] Graphique janvier sauvegarde -> production_janvier.png")

    # ── Graphique 2 : production mensuelle (barres) ───────────────────────
    fig2, ax2 = plt.subplots(figsize=(12, 5))
    mois_labels = ["Jan","Fév","Mar","Avr","Mai","Jun",
                   "Jul","Aoû","Sep","Oct","Nov","Déc"]
    x = np.arange(12)
    width = 0.35

    for i, (nom, df) in enumerate(resultats.items()):
        df2 = df.copy()
        df2["mois"] = pd.to_datetime(df2["date"]).dt.month
        mensuel = df2.groupby("mois")["production"].sum() / 1_000  # → MWh
        ax2.bar(x + i * width, mensuel.values, width, label=nom, alpha=0.85)

    ax2.set_xticks(x + width / 2)
    ax2.set_xticklabels(mois_labels)
    ax2.set_ylabel("Production mensuelle (MWh)")
    ax2.set_title("Production mensuelle par centrale — 2035")
    ax2.legend()
    ax2.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig("production_mensuelle.png", dpi=120)
    print("[OK] Graphique mensuel sauvegarde  -> production_mensuelle.png")

    plt.show()

    # =========================================================================
    # Section résidentielle — base W/m² pour toutes les MRCs (appels PVGIS réels)
    # =========================================================================
    from harmoniq.modules.solaire.data_solaire import coordinates_residential_MRC

    MOIS = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aou","Sep","Oct","Nov","Dec"]

    print(f"\n>> Calcul base W/m² pour toutes les MRCs ({len(coordinates_residential_MRC)} appels PVGIS)...")
    base_df = calculate_base_production_per_m2(
        coordinates=coordinates_residential_MRC,
        surface_tilt=30.0,
        surface_orientation=180.0,
    )
    print(f"[OK] Base calculée : {len(base_df):,} lignes")
    print(f"     Colonnes      : {list(base_df.columns)}")
    print(f"     MRCs          : {base_df['mrc'].unique().tolist()}")
    print(f"     W/m² max      : {base_df['production_w_per_m2'].max():.1f}")
    print(f"     W/m² moy jour : {base_df[base_df['production_w_per_m2'] > 0]['production_w_per_m2'].mean():.1f}")
    print(base_df.head(6).to_string(index=False))

    # ── Export CSV ────────────────────────────────────────────────────────────
    base_df.to_csv("base_production_mrc.csv", index=False)
    print(f"\n[OK] base_production_mrc.csv sauvegardé ({len(base_df):,} lignes, {base_df['mrc'].nunique()} MRCs)")

    # ── Graphique : production annuelle kWh/m² — 3 MRCs clés ────────────────
    MRC_AFFICHEES = ["Montréal", "Laval", "Longueuil"]
    annuel = (
        base_df[base_df["mrc"].isin(MRC_AFFICHEES)]
        .groupby("mrc")["production_w_per_m2"].sum() / 1000  # Wh/m² → kWh/m²
    ).reindex(MRC_AFFICHEES)

    fig5, ax5 = plt.subplots(figsize=(8, 5))
    colors_mrc = ["#5fa2dd", "#f4a261", "#2a9d8f"]
    bars = ax5.bar(MRC_AFFICHEES, annuel.values, color=colors_mrc, alpha=0.85)
    ax5.bar_label(bars, fmt="%.0f kWh/m²", padding=4)

    ax5.set_ylabel("Production annuelle (kWh/m²)")
    ax5.set_title("Production solaire annuelle — Montréal, Laval, Longueuil — TMY")
    ax5.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig("resid_production_mensuelle.png", dpi=120)
    print("[OK] resid_production_mensuelle.png sauvegardé")

    plt.show()
