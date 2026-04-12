# -*- coding: utf-8 -*-
"""
Identification des meilleurs sites potentiels pour le placement de barrages
sur une riviere a partir d'un profil d'altitude (altitude.txt).

Colonnes du fichier :
  1. Distance cumulee le long de la riviere (m)
  2. Coordonnee X
  3. Coordonnee Y
  4. Altitude (m)

Logique :
  Pour chaque fenetre de distance choisie par l'utilisateur (ex. 100, 250, 500 m),
  on parcourt tous les points du profil. Pour chaque point amont (i), on cherche
  le point aval situe a environ [fenetre] metres en aval, puis on calcule :
      H = altitude_amont - altitude_aval
  On ne retient que les chutes positives, on elimine les sites trop proches,
  et on classe les meilleurs.
"""

import os
import sys
import csv
import numpy as np
import pandas as pd


# ============================================================
# 1. Lecture du fichier
# ============================================================

def lire_fichier_altitude(chemin: str) -> pd.DataFrame:
    """
    Lit le fichier de profil et retourne un DataFrame avec les colonnes :
    distance, x, y, altitude.
    Gere les separateurs tab, virgule ou espaces.
    """
    if not os.path.isfile(chemin):
        raise FileNotFoundError(f"Le fichier '{chemin}' est introuvable.")

    with open(chemin, "r", encoding="utf-8") as f:
        lignes = [l for l in f.readlines() if l.strip()]

    if not lignes:
        raise ValueError("Le fichier est vide.")

    premiere = lignes[0].strip()
    if "\t" in premiere:
        sep = r"\t"
    elif "," in premiere:
        sep = ","
    else:
        sep = r"\s+"

    df = pd.read_csv(
        chemin,
        sep=sep,
        header=None,
        engine="python",
        encoding="utf-8",
        dtype=float,
        on_bad_lines="skip",   # ignore les lignes mal formees
    )

    if df.shape[1] < 4:
        raise ValueError(
            f"Le fichier doit avoir au moins 4 colonnes (detecte : {df.shape[1]})."
        )

    # Colonnes : premiere=distance, 2e=x, 3e=y, derniere=altitude
    df = df.iloc[:, [0, 1, 2, -1]].copy()
    df.columns = ["distance", "x", "y", "altitude"]

    # Supprimer les lignes avec NaN
    avant = len(df)
    df.dropna(inplace=True)
    if len(df) < avant:
        print(f"  -> {avant - len(df)} ligne(s) invalide(s) ignoree(s).")

    return df


# ============================================================
# 2. Nettoyage : doublons et tri
# ============================================================

def nettoyer_donnees(df: pd.DataFrame) -> pd.DataFrame:
    """
    Supprime les doublons exacts puis trie par distance croissante.
    """
    avant = len(df)
    df = df.drop_duplicates(subset=["distance", "x", "y", "altitude"])
    doublons = avant - len(df)
    if doublons:
        print(f"  -> {doublons} doublon(s) supprime(s).")

    df = df.sort_values("distance").reset_index(drop=True)
    return df


# ============================================================
# 3. Saisie des fenetres de distance
# ============================================================

def saisir_fenetres() -> list:
    """
    Demande a l'utilisateur les fenetres de distance a analyser.
    Exemple de saisie : 100,250,500
    Retourne une liste de floats tries.
    """
    print("\n  Entrez les fenetres de distance a analyser (en metres),")
    print("  separees par des virgules. Exemple : 100,250,500")
    saisie = input("  Fenetres : ").strip()

    fenetres = []
    for token in saisie.split(","):
        token = token.strip()
        try:
            val = float(token)
            if val <= 0:
                print(f"  [IGNORE] Fenetre invalide (doit etre > 0) : {token}")
            else:
                fenetres.append(val)
        except ValueError:
            print(f"  [IGNORE] Valeur non numerique ignoree : '{token}'")

    if not fenetres:
        raise ValueError("Aucune fenetre valide saisie.")

    fenetres = sorted(set(fenetres))
    print(f"  Fenetres retenues : {fenetres} m")
    return fenetres


# ============================================================
# 4. Calcul des chutes sur une fenetre de distance donnee
# ============================================================

def calculer_chutes_fenetre(df: pd.DataFrame, fenetre: float) -> list:
    """
    Pour une fenetre de distance donnee, parcourt tous les points amont
    et trouve le point aval situe a ~fenetre metres en aval.
    Calcule H = altitude_amont - altitude_aval.
    Ne retient que les chutes positives.

    Le point aval est le point dont la distance est la plus proche de
    (distance_amont + fenetre), parmi les points strictement en aval.

    Retourne une liste de dictionnaires.
    """
    distances = df["distance"].values
    altitudes = df["altitude"].values
    xs = df["x"].values
    ys = df["y"].values
    n = len(df)

    chutes = []

    for i in range(n - 1):
        dist_cible = distances[i] + fenetre

        # Chercher uniquement parmi les points en aval (j > i)
        indices_aval = np.arange(i + 1, n)
        if len(indices_aval) == 0:
            continue

        # Trouver le point aval le plus proche de la distance cible
        ecarts = np.abs(distances[indices_aval] - dist_cible)
        j = indices_aval[np.argmin(ecarts)]

        # Verifier que le point aval est bien en aval (distance strictement superieure)
        if distances[j] <= distances[i]:
            continue

        H = altitudes[i] - altitudes[j]
        if H <= 0:
            continue  # On ne garde que les vraies descentes

        dist_reelle = distances[j] - distances[i]
        pente = H / dist_reelle if dist_reelle > 0 else 0.0

        chutes.append({
            "fenetre_m":        fenetre,
            "index_amont":      i,
            "distance_amont":   distances[i],
            "x_amont":          xs[i],
            "y_amont":          ys[i],
            "altitude_amont":   altitudes[i],
            "index_aval":       j,
            "distance_aval":    distances[j],
            "x_aval":           xs[j],
            "y_aval":           ys[j],
            "altitude_aval":    altitudes[j],
            "hauteur_chute":    H,
            "distance_reelle":  dist_reelle,
            "pente_m_per_m":    pente,
        })

    # Trier par hauteur de chute decroissante
    chutes.sort(key=lambda c: c["hauteur_chute"], reverse=True)
    return chutes


# ============================================================
# 5. Filtrage des sites trop proches (deduplication spatiale)
# ============================================================

def filtrer_sites_proches(chutes: list, rayon_min: float) -> list:
    """
    Elimine les sites dont le point amont est a moins de rayon_min metres
    d'un site deja retenu (en distance cumulee le long de la riviere).

    Les sites sont parcourus du meilleur au moins bon.
    Retourne la liste filtree.
    """
    retenus = []
    distances_retenues = []

    for site in chutes:
        d = site["distance_amont"]
        trop_proche = any(
            abs(d - dr) < rayon_min for dr in distances_retenues
        )
        if not trop_proche:
            retenus.append(site)
            distances_retenues.append(d)

    return retenus


# ============================================================
# 6. Affichage des resultats
# ============================================================

def afficher_resultats(resultats: list, top_n: int = 10) -> None:
    """
    Affiche les top_n meilleurs sites dans la console,
    groupes par fenetre de distance.
    """
    if not resultats:
        print("\n  Aucun site retenu.")
        return

    # Grouper par fenetre
    fenetres_presentes = sorted(set(s["fenetre_m"] for s in resultats))

    for fen in fenetres_presentes:
        sites_fen = [s for s in resultats if s["fenetre_m"] == fen]
        print(f"\n{'='*75}")
        print(f"  FENETRE {fen:.0f} m  —  {len(sites_fen)} site(s) retenu(s)")
        print(f"{'='*75}")

        for rang, s in enumerate(sites_fen[:top_n], start=1):
            print(f"\n  Rang {rang}  |  Chute : {s['hauteur_chute']:.1f} m  "
                  f"|  Pente : {s['pente_m_per_m']*100:.3f} %  "
                  f"|  Dist. reelle : {s['distance_reelle']:.1f} m")
            print(f"    Amont  [idx={s['index_amont']:>5d}] "
                  f"dist={s['distance_amont']:>10.1f} m  "
                  f"X={s['x_amont']:.6f}  Y={s['y_amont']:.6f}  "
                  f"alt={s['altitude_amont']:.1f} m")
            print(f"    Aval   [idx={s['index_aval']:>5d}] "
                  f"dist={s['distance_aval']:>10.1f} m  "
                  f"X={s['x_aval']:.6f}  Y={s['y_aval']:.6f}  "
                  f"alt={s['altitude_aval']:.1f} m")

    print()


# ============================================================
# 7. Export CSV
# ============================================================

def sauvegarder_csv(resultats: list, chemin_csv: str) -> None:
    """
    Sauvegarde tous les sites retenus dans un fichier CSV.
    Chaque ligne correspond a un site, avec son rang par fenetre.
    """
    if not resultats:
        print("  Aucun resultat a sauvegarder.")
        return

    entetes = [
        "rang_global",
        "rang_fenetre",
        "fenetre_m",
        "hauteur_chute",
        "pente_m_per_m",
        "distance_reelle",
        "index_amont",
        "distance_amont",
        "x_amont",
        "y_amont",
        "altitude_amont",
        "index_aval",
        "distance_aval",
        "x_aval",
        "y_aval",
        "altitude_aval",
    ]

    # Calculer le rang par fenetre
    compteurs = {}
    lignes = []
    for rang_global, s in enumerate(resultats, start=1):
        fen = s["fenetre_m"]
        compteurs[fen] = compteurs.get(fen, 0) + 1
        ligne = {
            "rang_global":    rang_global,
            "rang_fenetre":   compteurs[fen],
            "fenetre_m":      s["fenetre_m"],
            "hauteur_chute":  round(s["hauteur_chute"], 3),
            "pente_m_per_m":  round(s["pente_m_per_m"], 6),
            "distance_reelle": round(s["distance_reelle"], 2),
            "index_amont":    s["index_amont"],
            "distance_amont": round(s["distance_amont"], 2),
            "x_amont":        s["x_amont"],
            "y_amont":        s["y_amont"],
            "altitude_amont": round(s["altitude_amont"], 3),
            "index_aval":     s["index_aval"],
            "distance_aval":  round(s["distance_aval"], 2),
            "x_aval":         s["x_aval"],
            "y_aval":         s["y_aval"],
            "altitude_aval":  round(s["altitude_aval"], 3),
        }
        lignes.append(ligne)

    with open(chemin_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=entetes)
        writer.writeheader()
        writer.writerows(lignes)

    print(f"  [OK] {len(lignes)} site(s) sauvegardes dans : {chemin_csv}")


# ============================================================
# 8. Fonction principale
# ============================================================

def main():
    dossier_script = os.path.dirname(os.path.abspath(__file__))
    chemin_altitude = os.path.join(dossier_script, "altitude.txt")
    chemin_csv      = os.path.join(dossier_script, "meilleures_chutes.csv")

    print("=" * 65)
    print("  IDENTIFICATION DES MEILLEURS SITES POUR BARRAGES")
    print("  (analyse par fenetres de distance)")
    print("=" * 65)

    # --- Lecture ---
    print(f"\n  Lecture : {chemin_altitude}")
    try:
        df = lire_fichier_altitude(chemin_altitude)
    except (FileNotFoundError, ValueError) as e:
        print(f"\n  [ERREUR] {e}")
        sys.exit(1)

    print(f"  -> {len(df)} lignes lues.")

    # --- Nettoyage ---
    df = nettoyer_donnees(df)
    dist_totale = df["distance"].max() - df["distance"].min()
    print(f"  -> {len(df)} points apres nettoyage.")
    print(f"  -> Altitudes : {df['altitude'].min():.1f} m "
          f"a {df['altitude'].max():.1f} m  "
          f"(delta = {df['altitude'].max() - df['altitude'].min():.1f} m)")
    print(f"  -> Distance totale : {dist_totale:.1f} m")

    # --- Saisie des fenetres ---
    try:
        fenetres = saisir_fenetres()
    except ValueError as e:
        print(f"\n  [ERREUR] {e}")
        sys.exit(1)

    # Rayon de deduplication : par defaut = la plus petite fenetre / 2
    rayon_dedup = min(fenetres) / 2
    print(f"\n  Rayon de deduplication spatiale : {rayon_dedup:.1f} m")

    # --- Saisie du nombre de resultats a afficher ---
    try:
        top_n = int(input("  Nombre de meilleurs sites a afficher par fenetre [defaut=5] : ").strip() or "5")
        if top_n <= 0:
            top_n = 5
    except ValueError:
        top_n = 5

    # --- Calcul pour chaque fenetre ---
    tous_les_sites = []

    for fen in fenetres:
        print(f"\n  Analyse de la fenetre {fen:.0f} m ...")
        chutes = calculer_chutes_fenetre(df, fen)
        print(f"    -> {len(chutes)} chutes positives trouvees.")

        chutes_filtrees = filtrer_sites_proches(chutes, rayon_dedup)
        print(f"    -> {len(chutes_filtrees)} sites retenus apres deduplication.")

        tous_les_sites.extend(chutes_filtrees)

    if not tous_les_sites:
        print("\n  Aucun site potentiel trouve avec les parametres choisis.")
        sys.exit(0)

    # --- Affichage ---
    afficher_resultats(tous_les_sites, top_n=top_n)

    # --- Sauvegarde CSV ---
    sauvegarder_csv(tous_les_sites, chemin_csv)


# ============================================================
# Point d'entree
# ============================================================

if __name__ == "__main__":
    main()
