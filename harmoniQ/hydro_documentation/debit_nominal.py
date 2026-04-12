# -*- coding: utf-8 -*-
"""
Estimation du débit nominal d'une rivière par la méthode de la courbe de durée des débits.

Fichier source : fichier journalier CEHQ (format windows-1252)
Sortie         : debit_nominal_resultats.csv  +  courbe_duree_debits.png

Méthode :
    On trie l'historique des débits du plus grand au plus petit afin de construire
    la courbe de durée. Le débit correspondant à un pourcentage de dépassement de
    30 % (Q30) est retenu comme débit nominal recommandé, car il représente un
    niveau fréquemment atteint ou dépassé sans être un débit de crue exceptionnel.

CORRECTION v2 : encodage windows-1252 pour les fichiers CEHQ du gouvernement du Québec.
"""

import os
import csv
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker


# ==============================================================================
# PARAMÈTRES
# ==============================================================================

FICHIER_ENTREE = "CANIAPISCAUUUU.txt"
QUANTILES_CIBLES = [20, 25, 30, 40]
QUANTILE_NOMINAL = 30
FICHIER_CSV_SORTIE = "debit_nominal_resultats.csv"
FICHIER_PNG_SORTIE = "courbe_duree_debits.png"


# ==============================================================================
# 1. LECTURE ROBUSTE DU FICHIER
# ==============================================================================

def lire_debits(chemin: str) -> tuple:
    if not os.path.isfile(chemin):
        raise FileNotFoundError(f"Fichier introuvable : '{chemin}'")

    # Essai d'encodages successifs — windows-1252 en priorité pour les fichiers CEHQ
    encodages = ["windows-1252", "latin-1", "utf-8", "utf-8-sig"]
    lignes_brutes = None
    encodage_ok = None

    for enc in encodages:
        try:
            with open(chemin, "r", encoding=enc) as f:
                lignes_brutes = [l for l in f.readlines() if l.strip()]
            encodage_ok = enc
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if lignes_brutes is None:
        raise ValueError("Impossible de lire le fichier avec les encodages testés.")

    print(f"  -> Encodage détecté : {encodage_ok}")

    premiere = lignes_brutes[0].strip() if lignes_brutes else ""
    if "\t" in premiere:
        sep = r"\t"
    elif "," in premiere:
        sep = ","
    else:
        sep = r"\s+"

    df = pd.read_csv(
        chemin,
        sep=sep,
        header=0,
        engine="python",
        encoding=encodage_ok,
        on_bad_lines="skip",
    )

    nb_lignes_brutes = len(df)
    print(f"  -> {nb_lignes_brutes} lignes lues (hors en-tête).")
    print(f"  -> Colonnes détectées : {list(df.columns)}")

    mots_cles = ["debit", "débit", "flow", "discharge", "m3", "m³", "q"]
    colonne_debit = None

    for col in df.columns:
        col_norm = col.lower().replace(" ", "").replace("(", "").replace(")", "")
        if any(mot in col_norm for mot in mots_cles):
            colonne_debit = col
            break

    if colonne_debit is None:
        for col in df.columns:
            serie = pd.to_numeric(df[col], errors="coerce")
            if serie.notna().sum() > nb_lignes_brutes * 0.5:
                colonne_debit = col
                break

    if colonne_debit is None:
        raise ValueError(
            "Impossible d'identifier une colonne de débits dans le fichier. "
            f"Colonnes disponibles : {list(df.columns)}"
        )

    print(f"  -> Colonne de débits retenue : « {colonne_debit} »")

    debits = pd.to_numeric(df[colonne_debit], errors="coerce")
    nb_brut = debits.notna().sum()
    debits = debits.dropna()
    debits = debits[debits > 0]
    nb_supprimes = nb_brut - len(debits)

    if nb_supprimes > 0:
        print(f"  -> {nb_supprimes} valeur(s) supprimée(s) (nulles, négatives ou non numériques).")

    return debits.reset_index(drop=True), nb_lignes_brutes


# ==============================================================================
# 2. COURBE DE DURÉE DES DÉBITS
# ==============================================================================

def courbe_duree(debits: pd.Series) -> tuple:
    debits_tries = np.sort(debits.values)[::-1]
    n = len(debits_tries)
    rangs = np.arange(1, n + 1)
    pct_depassement = rangs / (n + 1) * 100
    return pct_depassement, debits_tries


def calculer_quantile_duree(pct_depassement: np.ndarray,
                             debits_tries: np.ndarray,
                             p: float) -> float:
    return float(np.interp(p, pct_depassement, debits_tries))


# ==============================================================================
# 3. AFFICHAGE DES RÉSULTATS
# ==============================================================================

def afficher_resultats(nb_lignes_brutes, debits, valeurs_q, q_nominal):
    sep = "=" * 65
    print(f"\n{sep}")
    print("   RÉSULTATS — ESTIMATION DU DÉBIT NOMINAL")
    print(f"{sep}")
    print(f"\n  Nombre total de lignes lues         : {nb_lignes_brutes}")
    print(f"  Valeurs de débit valides retenues   : {len(debits)}")
    print(f"\n  Débit minimal observé               : {debits.min():.2f} m³/s")
    print(f"  Débit maximal observé               : {debits.max():.2f} m³/s")
    print(f"  Débit moyen (module)                : {debits.mean():.2f} m³/s")
    print(f"  Débit médian (Q50)                  : {debits.median():.2f} m³/s")

    print("\n  --- Débits issus de la courbe de durée ---")
    for label, val in valeurs_q.items():
        marqueur = "  <- NOMINAL RECOMMANDÉ" if label == f"Q{QUANTILE_NOMINAL}" else ""
        print(f"  {label:<6s}  :  {val:>10.2f} m³/s{marqueur}")

    print(f"\n  Débit nominal recommandé (Q{QUANTILE_NOMINAL}) : {q_nominal:.2f} m³/s")
    print(f"\n{sep}\n")


# ==============================================================================
# 4. EXPORT CSV
# ==============================================================================

def sauvegarder_csv(debits, valeurs_q, q_nominal, chemin_csv):
    lignes = [
        {"Paramètre": "Nombre de valeurs valides",   "Valeur (m³/s)": len(debits)},
        {"Paramètre": "Débit minimal",               "Valeur (m³/s)": round(debits.min(), 3)},
        {"Paramètre": "Débit maximal",               "Valeur (m³/s)": round(debits.max(), 3)},
        {"Paramètre": "Débit moyen (module)",        "Valeur (m³/s)": round(float(debits.mean()), 3)},
        {"Paramètre": "Débit médian (Q50)",          "Valeur (m³/s)": round(float(debits.median()), 3)},
    ]
    for label, val in valeurs_q.items():
        lignes.append({"Paramètre": label, "Valeur (m³/s)": round(val, 3)})
    lignes.append({
        "Paramètre": f"Débit nominal recommandé (Q{QUANTILE_NOMINAL})",
        "Valeur (m³/s)": round(q_nominal, 3)
    })

    with open(chemin_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["Paramètre", "Valeur (m³/s)"])
        writer.writeheader()
        writer.writerows(lignes)

    print(f"  [OK] Résultats CSV sauvegardés : {chemin_csv}")


# ==============================================================================
# 5. GRAPHIQUE
# ==============================================================================

def tracer_courbe(pct_depassement, debits_tries, valeurs_q, q_nominal, chemin_png):
    palette = {
        f"Q{p}": c for p, c in zip(
            QUANTILES_CIBLES,
            ["#e07b39", "#d4a017", "#27ae60", "#2980b9"]
        )
    }

    fig, ax = plt.subplots(figsize=(13, 6))
    ax.plot(pct_depassement, debits_tries,
            color="#34495e", linewidth=1.8,
            label="Courbe de durée des débits", zorder=2)

    plage_y = float(debits_tries.max() - debits_tries.min())

    for label, val in valeurs_q.items():
        p = float(label[1:])
        couleur = palette.get(label, "gray")
        est_nominal = (label == f"Q{QUANTILE_NOMINAL}")
        lw = 2.5 if est_nominal else 1.5
        ls = "--" if est_nominal else ":"

        ax.axvline(x=p,   color=couleur, linewidth=lw, linestyle=ls, alpha=0.8)
        ax.axhline(y=val, color=couleur, linewidth=lw, linestyle=ls, alpha=0.8)
        ax.plot(p, val, "o", color=couleur, markersize=9,
                zorder=5, markeredgecolor="white", markeredgewidth=1.5)
        ax.annotate(
            f"{label} = {val:.1f} m³/s",
            xy=(p, val),
            xytext=(p + 1.8, val + plage_y * 0.03),
            fontsize=10,
            color=couleur,
            fontweight="bold" if est_nominal else "normal",
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white",
                      edgecolor=couleur, alpha=0.9),
        )

    ax.set_xlabel("Pourcentage de dépassement (%)", fontsize=13)
    ax.set_ylabel("Débit (m³/s)", fontsize=13)
    ax.set_title(
        f"Courbe de durée des débits\n"
        f"Débit nominal recommandé : Q{QUANTILE_NOMINAL} = {q_nominal:.1f} m³/s",
        fontsize=14, fontweight="bold",
    )
    ax.set_xlim(0, 100)
    ax.set_ylim(bottom=0)
    ax.grid(True, which="both", linestyle="--", linewidth=0.5, alpha=0.55)
    ax.xaxis.set_minor_locator(ticker.AutoMinorLocator())
    ax.yaxis.set_minor_locator(ticker.AutoMinorLocator())
    ax.legend(fontsize=11, loc="upper right")

    plt.tight_layout()
    plt.savefig(chemin_png, dpi=150)
    plt.show()
    print(f"  [OK] Graphique sauvegardé : {chemin_png}")


# ==============================================================================
# POINT D'ENTRÉE
# ==============================================================================

if __name__ == "__main__":

    dossier   = os.path.dirname(os.path.abspath(__file__))
    ch_entree = os.path.join(dossier, FICHIER_ENTREE)
    ch_csv    = os.path.join(dossier, FICHIER_CSV_SORTIE)
    ch_png    = os.path.join(dossier, FICHIER_PNG_SORTIE)

    print("=" * 65)
    print("  DÉBIT NOMINAL — COURBE DE DURÉE DES DÉBITS  (v2 CEHQ)")
    print("=" * 65)
    print(f"\n  Fichier source : {ch_entree}\n")

    debits, nb_lignes_brutes = lire_debits(ch_entree)
    pct_depassement, debits_tries = courbe_duree(debits)

    valeurs_q = {
        f"Q{p}": calculer_quantile_duree(pct_depassement, debits_tries, p)
        for p in QUANTILES_CIBLES
    }
    q_nominal = valeurs_q[f"Q{QUANTILE_NOMINAL}"]

    afficher_resultats(nb_lignes_brutes, debits, valeurs_q, q_nominal)
    sauvegarder_csv(debits, valeurs_q, q_nominal, ch_csv)
    tracer_courbe(pct_depassement, debits_tries, valeurs_q, q_nominal, ch_png)
