# -*- coding: utf-8 -*-
"""
Identification des meilleurs sites potentiels pour le placement de barrages
sur une riviere a partir d'un profil d'altitude (altitude.txt).

MODIFICATION v2 — Centre de référence empirique (données HQ réelles)
---------------------------------------------------------------------
La version originale utilisait le centre GÉOMÉTRIQUE de la plage de débit
comme référence pour recommander le nombre de turbines :

    Q_centre = sqrt(Qmin * Qmax)   →  32 m³/s pour Francis

Ce centre théorique conduisait à recommander un très grand nombre de petites
turbines (ex. 56 Francis pour Q=1786 m³/s), très éloigné des pratiques réelles.

La version v2 remplace ce centre par des valeurs EMPIRIQUES calculées à partir
des 63 centrales du réseau Hydro-Québec (fichier Info_Barrages.csv),
filtrées sur les centrales de puissance >= 200 MW pour être représentatives
des grands aménagements :

    Francis : médiane de Q/turbine = 206 m³/s  (33 centrales)
    Kaplan  : médiane de Q/turbine = 339 m³/s  (5 centrales)
    Pelton  : médiane de Q/turbine = 142 m³/s  (1 centrale — SM-3)

Exemple de résultat pour Caniapiscau site 1 (H=65m, Q=1786 m³/s, Francis) :
    v1 (centre géométrique) : 56 turbines à  32 m³/s chacune
    v2 (centre empirique)   :  9 turbines à 199 m³/s chacune  ← réaliste
"""

import os
import sys
import csv
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors


# =============================================================================
# 1. DONNÉES DES TURBINES
# =============================================================================

kaplan  = {'type': 'kaplan',  'Qmin': 10,  'Qmax': 1000, 'Hmin': 5,   'Hmax': 80,   'etamax': 0.95}
pelton  = {'type': 'pelton',  'Qmin': 0.5, 'Qmax': 20,   'Hmin': 100, 'Hmax': 1800, 'etamax': 0.96}
francis = {'type': 'francis', 'Qmin': 1,   'Qmax': 1000, 'Hmin': 30,  'Hmax': 750,  'etamax': 0.91}

SEUIL_KAPLAN_FRANCIS = 50    # mètres
SEUIL_FRANCIS_PELTON = 200   # mètres


# =============================================================================
# 2. CENTRES EMPIRIQUES HQ  [MODIFICATION v2]
# =============================================================================
# Débit par turbine médian calculé depuis Info_Barrages.csv (centrales >= 200 MW)
#
#   Francis : 33 centrales analysées, médiane = 206 m³/s
#             Ex. réels : Robert-Bourassa (287), Laforge-1 (286), La Grande-3 (286)
#
#   Kaplan  : 5 centrales analysées, médiane = 339 m³/s
#             Ex. réels : Carillon (322), Beauharnois_Kaplan (274), La Grande-1 (467)
#
#   Pelton  : 1 centrale (Sainte-Marguerite-3), médiane = 142 m³/s
#             Données insuffisantes — valeur indicative seulement

CENTRES_EMPIRIQUES_HQ = {
    'Kaplan':  339,   # m³/s par turbine
    'Francis': 206,   # m³/s par turbine
    'Pelton':  142,   # m³/s par turbine
}


# =============================================================================
# 3. SÉLECTION AUTOMATIQUE DE TURBINE
# =============================================================================

def choisir_turbine(H):
    """
    Sélectionne automatiquement un type de turbine hydraulique
    en fonction de la hauteur de chute H (en mètres).

    Règle de classification :
        H < 50 m       → Kaplan   (basses chutes)
        50 ≤ H < 200 m → Francis  (moyennes chutes)
        H ≥ 200 m      → Pelton   (hautes chutes)

    Paramètres
    ----------
    H : float
        Hauteur de chute nette en mètres.

    Retourne
    --------
    dict avec les clés :
        'nom'       : str   - Nom de la turbine recommandée
        'couleur'   : str   - Couleur associée pour la visualisation
        'turbine'   : dict  - Paramètres complets de la turbine
        'plage'     : str   - Description de la plage de H
    """
    if H < SEUIL_KAPLAN_FRANCIS:
        return {
            'nom': 'Kaplan',
            'couleur': 'blue',
            'turbine': kaplan,
            'plage': f'H < {SEUIL_KAPLAN_FRANCIS} m (basses chutes)'
        }
    elif H < SEUIL_FRANCIS_PELTON:
        return {
            'nom': 'Francis',
            'couleur': 'red',
            'turbine': francis,
            'plage': f'{SEUIL_KAPLAN_FRANCIS} ≤ H < {SEUIL_FRANCIS_PELTON} m (moyennes chutes)'
        }
    else:
        return {
            'nom': 'Pelton',
            'couleur': 'green',
            'turbine': pelton,
            'plage': f'H ≥ {SEUIL_FRANCIS_PELTON} m (hautes chutes)'
        }


# =============================================================================
# 4. CALCUL DU NOMBRE DE TURBINES  [MODIFICATION v2]
# =============================================================================

def calculer_nombre_turbines(Q_total, turbine_info, X_max=100):
    """
    Détermine le nombre de turbines à installer pour un débit total Q_total.

    MODIFICATION v2 :
        Le centre de référence utilisé pour choisir le meilleur X est maintenant
        la MÉDIANE EMPIRIQUE du débit par turbine observée sur les grandes
        centrales d'Hydro-Québec (>= 200 MW), au lieu du centre géométrique
        théorique sqrt(Qmin * Qmax).

        Ancien centre Francis : sqrt(1 * 1000) =  32 m³/s  (théorique)
        Nouveau centre Francis :                  206 m³/s  (empirique HQ)

    Logique :
        Pour chaque entier X = 1, 2, 3, ..., on vérifie si :
            Qmin <= Q_total / X <= Qmax
        Parmi les valeurs valides, on recommande celle dont le débit
        par turbine est le plus proche du CENTRE EMPIRIQUE HQ.

    Paramètres
    ----------
    Q_total : float
        Débit total du barrage en m³/s.
    turbine_info : dict
        Dictionnaire retourné par choisir_turbine(H).
    X_max : int, optional
        Nombre maximal de turbines à tester (par défaut 100).

    Retourne
    --------
    dict avec les clés :
        'type_turbine'       : str   - Nom de la turbine
        'Q_total'            : float - Débit total
        'Qmin'               : float - Débit min par turbine
        'Qmax'               : float - Débit max par turbine
        'Q_centre_empirique' : float - Centre empirique HQ utilisé  [NOUVEAU]
        'Q_centre_geometrique': float - Ancien centre géométrique    [NOUVEAU]
        'X_possibles'        : list  - Liste des nombres de turbines valides
        'X_recommande'       : int   - Nombre de turbines recommandé
        'Q_par_turbine'      : float - Débit par turbine pour X recommandé
        'valide'             : bool  - True si au moins une solution existe
    """
    turbine = turbine_info['turbine']
    Qmin = turbine['Qmin']
    Qmax = turbine['Qmax']

    # [MODIFICATION v2] Centre empirique HQ au lieu du centre géométrique
    Q_centre = CENTRES_EMPIRIQUES_HQ.get(turbine_info['nom'], np.sqrt(Qmin * Qmax))
    Q_centre_geo = np.sqrt(Qmin * Qmax)  # conservé pour affichage comparatif

    X_possibles = []
    for X in range(1, X_max + 1):
        Q_par_turbine = Q_total / X
        if Qmin <= Q_par_turbine <= Qmax:
            X_possibles.append(X)

    if not X_possibles:
        return {
            'type_turbine': turbine_info['nom'],
            'Q_total': Q_total,
            'Qmin': Qmin,
            'Qmax': Qmax,
            'Q_centre_empirique': Q_centre,
            'Q_centre_geometrique': Q_centre_geo,
            'X_possibles': [],
            'X_recommande': None,
            'Q_par_turbine': None,
            'valide': False
        }

    meilleur_X = min(X_possibles, key=lambda x: abs(Q_total / x - Q_centre))

    return {
        'type_turbine': turbine_info['nom'],
        'Q_total': Q_total,
        'Qmin': Qmin,
        'Qmax': Qmax,
        'Q_centre_empirique': Q_centre,
        'Q_centre_geometrique': Q_centre_geo,
        'X_possibles': X_possibles,
        'X_recommande': meilleur_X,
        'Q_par_turbine': Q_total / meilleur_X,
        'valide': True
    }


# =============================================================================
# 5. AFFICHAGE DES RÉSULTATS
# =============================================================================

def afficher_resultats_nombre_turbines(H, turbine_info, resultat_nb):
    """
    Affiche de manière lisible les résultats du calcul du nombre de turbines.
    """
    print("\n" + "=" * 65)
    print("   RÉSULTATS — DIMENSIONNEMENT DU NOMBRE DE TURBINES  (v2)")
    print("=" * 65)
    print(f"\n  Hauteur de chute H        : {H} m")
    print(f"  Type de turbine choisi    : {turbine_info['nom']}")
    print(f"  Plage de sélection        : {turbine_info['plage']}")
    print(f"  Débit total Q             : {resultat_nb['Q_total']} m³/s")
    print(f"  Plage de débit/turbine    : [{resultat_nb['Qmin']}, {resultat_nb['Qmax']}] m³/s")

    # [MODIFICATION v2] Affichage comparatif des deux centres
    print(f"\n  Centre géométrique (v1)   : {resultat_nb['Q_centre_geometrique']:.1f} m³/s  ← ancien")
    print(f"  Centre empirique HQ (v2)  : {resultat_nb['Q_centre_empirique']:.0f} m³/s  ← nouveau (médiane centrales >= 200 MW)")

    if not resultat_nb['valide']:
        print(f"\n  Aucune solution trouvée !")
        Q_total = resultat_nb['Q_total']
        Qmin = resultat_nb['Qmin']
        Qmax = resultat_nb['Qmax']
        import math
        X_min_theorique = math.ceil(Q_total / Qmax)
        X_max_theorique = math.floor(Q_total / Qmin)
        print(f"  Pour que ce soit possible : X ∈ [{X_min_theorique}, {X_max_theorique}]")
    else:
        print(f"\n  Nombres de turbines possibles : {resultat_nb['X_possibles']}")
        print(f"  Nombre recommandé (v2)        : {resultat_nb['X_recommande']}")
        print(f"  Débit par turbine             : {resultat_nb['Q_par_turbine']:.2f} m³/s")

        # Tableau détaillé
        Q_centre = resultat_nb['Q_centre_empirique']
        sep = '─' * 55
        print(f"\n  {sep}")
        print(f"  {'X':>5s} │ {'Q/X (m³/s)':>12s} │ {'Écart au centre empirique':>25s}")
        print(f"  {sep}")
        for X in resultat_nb['X_possibles']:
            q = resultat_nb['Q_total'] / X
            ecart = abs(q - Q_centre)
            marqueur = " ⭐" if X == resultat_nb['X_recommande'] else ""
            print(f"  {X:>5d} │ {q:>12.2f} │ {ecart:>25.2f}{marqueur}")
        print(f"  {sep}")

    print()


# =============================================================================
# 6. FONCTION DE RENDEMENT NOMINAL
# =============================================================================

def rendement_nominal(Qnom, Hnom, type):
    """
    Calcule le rendement nominal d'une turbine.
    """
    Qmin   = type['Qmin']
    Qmax   = type['Qmax']
    Hmin   = type['Hmin']
    Hmax   = type['Hmax']
    etamax = type['etamax']

    QMA = 1 - np.tanh(4 * (np.log(Qnom / Qmax)))
    QMI = 1 + np.tanh(4 * (np.log(Qnom / Qmin)))
    HMA = 1 - np.tanh(4 * (np.log(Hnom / Hmax)))
    HMI = 1 + np.tanh(4 * (np.log(Hnom / Hmin)))
    ETA = etamax / 16 * QMA * QMI * HMA * HMI

    return ETA


# =============================================================================
# 7. FONCTIONS DE VISUALISATION  (inchangées)
# =============================================================================

def plot_efficiency(Q, H):
    Qnom, Hnom = np.meshgrid(Q, H)
    if isinstance(H, np.ndarray) and isinstance(Q, (int, float)):
        plt.figure(figsize=(20, 12))
        plt.semilogx(H, rendement_nominal(Q, H, kaplan),  label='Kaplan',  color='blue')
        plt.semilogx(H, rendement_nominal(Q, H, francis), label='Francis', color='red')
        plt.semilogx(H, rendement_nominal(Q, H, pelton),  label='Pelton',  color='green')
        plt.xlabel(r'Hauteur de charge nette (H)', fontsize=26)
        plt.ylabel(r'Rendement', fontsize=26)
        plt.title(r"Courbes de rendement en fonction du débit d'eau", fontsize=26)
        plt.grid(True)
        plt.legend(fontsize=26)
        plt.tick_params(axis='both', which='major', labelsize=26)
        plt.show()
    elif isinstance(Q, np.ndarray) and isinstance(H, (int, float)):
        plt.figure(figsize=(20, 12))
        plt.semilogx(Q, rendement_nominal(Q, H, kaplan),  label='Kaplan',  color='blue')
        plt.semilogx(Q, rendement_nominal(Q, H, francis), label='Francis', color='red')
        plt.semilogx(Q, rendement_nominal(Q, H, pelton),  label='Pelton',  color='green')
        plt.xlabel(r"Debit d'eau (Q)", fontsize=26)
        plt.ylabel(r'$\eta$', fontsize=26)
        plt.title(r"Courbes de rendement en fonction du debit d'eau", fontsize=26)
        plt.grid(True)
        plt.legend(fontsize=26)
        plt.tick_params(axis='both', which='major', labelsize=26)
        plt.show()
    else:
        colors_francis = [(1, 0, 0, 0), (1, 0, 0, .75)]
        colors_pelton  = [(0, 1, 0, 0), (0, 1, 0, .75)]
        colors_kaplan  = [(0, 0, 1, 0), (0, 0, 1, .75)]
        positions = [0, 1]
        cmap_francis = mcolors.LinearSegmentedColormap.from_list('cf', list(zip(positions, colors_francis)))
        cmap_pelton  = mcolors.LinearSegmentedColormap.from_list('cp', list(zip(positions, colors_pelton)))
        cmap_kaplan  = mcolors.LinearSegmentedColormap.from_list('ck', list(zip(positions, colors_kaplan)))

        plt.figure(figsize=(15, 9), facecolor='white')
        plt.contourf(Q, H, rendement_nominal(Qnom, Hnom, francis), cmap=cmap_francis)
        plt.contourf(Q, H, rendement_nominal(Qnom, Hnom, pelton),  cmap=cmap_pelton)
        plt.contourf(Q, H, rendement_nominal(Qnom, Hnom, kaplan),  cmap=cmap_kaplan)
        plt.xlabel(r'Q', fontsize=26)
        plt.ylabel(r'H', fontsize=26)
        plt.yscale('log')
        plt.xscale('log')
        plt.tick_params(axis='both', which='major', labelsize=26)
        colors = ['blue', 'red', 'green']
        labels = ['Kaplan', 'Francis', 'Pelton']
        plt.legend(
            handles=[plt.Rectangle((0, 0), 1, 1, color=c, label=l) for c, l in zip(colors, labels)],
            fontsize=20, loc='lower left'
        )
        plt.title(r'Carte de rendements par type de turbine:  $\eta = f(Q_{nom},H_{nom})$', fontsize=26)
        plt.show()


def afficher_selection(H_choisi, Q=None, H=None):
    N = 500
    if Q is None:
        Q = np.logspace(-0.6, 3.3, N)
    if H is None:
        H = np.logspace(0.3, 3.6, N)

    Qnom, Hnom = np.meshgrid(Q, H)
    resultat = choisir_turbine(H_choisi)

    fig, (ax_main, ax_zones) = plt.subplots(
        1, 2, figsize=(18, 9), facecolor='white',
        gridspec_kw={'width_ratios': [5, 1], 'wspace': 0.05}
    )

    colors_francis = [(1, 0, 0, 0), (1, 0, 0, .75)]
    colors_pelton  = [(0, 1, 0, 0), (0, 1, 0, .75)]
    colors_kaplan  = [(0, 0, 1, 0), (0, 0, 1, .75)]
    positions = [0, 1]
    cmap_francis = mcolors.LinearSegmentedColormap.from_list('cf', list(zip(positions, colors_francis)))
    cmap_pelton  = mcolors.LinearSegmentedColormap.from_list('cp', list(zip(positions, colors_pelton)))
    cmap_kaplan  = mcolors.LinearSegmentedColormap.from_list('ck', list(zip(positions, colors_kaplan)))

    ax_main.contourf(Q, H, rendement_nominal(Qnom, Hnom, francis), cmap=cmap_francis)
    ax_main.contourf(Q, H, rendement_nominal(Qnom, Hnom, pelton),  cmap=cmap_pelton)
    ax_main.contourf(Q, H, rendement_nominal(Qnom, Hnom, kaplan),  cmap=cmap_kaplan)

    ax_main.axhline(y=H_choisi, color=resultat['couleur'], linewidth=3,
                    linestyle='--', alpha=0.9, label=f'H = {H_choisi} m')

    # [MODIFICATION v2] Affichage du centre empirique sur le graphique
    Q_centre_emp = CENTRES_EMPIRIQUES_HQ.get(resultat['nom'])
    if Q_centre_emp and Q.min() <= Q_centre_emp <= Q.max():
        ax_main.plot(Q_centre_emp, H_choisi, 'D', color=resultat['couleur'],
                     markersize=12, markeredgecolor='white', markeredgewidth=2,
                     zorder=6, label=f'Centre empirique HQ ({Q_centre_emp} m³/s)')

    Q_mid = np.sqrt(Q.min() * Q.max())
    ax_main.plot(Q_mid, H_choisi, 'o', color=resultat['couleur'],
                 markersize=10, markeredgecolor='white', markeredgewidth=2,
                 zorder=5, alpha=0.4, label=f'Centre géométrique ({Q_mid:.0f} m³/s)')

    ax_main.annotate(
        f"  ← {resultat['nom']} recommandée",
        xy=(Q_mid * 1.5, H_choisi),
        fontsize=16, fontweight='bold',
        color=resultat['couleur'],
        va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                  edgecolor=resultat['couleur'], alpha=0.85)
    )

    ax_main.set_xlabel(r'Q (m³/s)', fontsize=20)
    ax_main.set_ylabel(r'H (m)', fontsize=20)
    ax_main.set_yscale('log')
    ax_main.set_xscale('log')
    ax_main.tick_params(axis='both', which='major', labelsize=16)
    ax_main.set_title(
        r'Carte de rendements  $\eta = f(Q_{nom}, H_{nom})$  —  Sélection de turbine (v2)',
        fontsize=20
    )

    legend_handles = [
        plt.Rectangle((0, 0), 1, 1, color='blue',  label='Kaplan'),
        plt.Rectangle((0, 0), 1, 1, color='red',   label='Francis'),
        plt.Rectangle((0, 0), 1, 1, color='green', label='Pelton'),
        plt.Line2D([0], [0], color=resultat['couleur'], linewidth=3,
                   linestyle='--', label=f'H = {H_choisi} m'),
    ]
    ax_main.legend(handles=legend_handles, fontsize=14, loc='lower left')

    H_min_graph = H.min()
    H_max_graph = H.max()

    ax_zones.axhspan(H_min_graph, SEUIL_KAPLAN_FRANCIS,           color='blue',  alpha=0.35)
    ax_zones.axhspan(SEUIL_KAPLAN_FRANCIS, SEUIL_FRANCIS_PELTON,  color='red',   alpha=0.35)
    ax_zones.axhspan(SEUIL_FRANCIS_PELTON, H_max_graph,           color='green', alpha=0.35)

    ax_zones.text(0.5, np.sqrt(H_min_graph * SEUIL_KAPLAN_FRANCIS),
                  'Kaplan',  ha='center', va='center', fontsize=13,
                  fontweight='bold', color='blue')
    ax_zones.text(0.5, np.sqrt(SEUIL_KAPLAN_FRANCIS * SEUIL_FRANCIS_PELTON),
                  'Francis', ha='center', va='center', fontsize=13,
                  fontweight='bold', color='red')
    ax_zones.text(0.5, np.sqrt(SEUIL_FRANCIS_PELTON * H_max_graph),
                  'Pelton',  ha='center', va='center', fontsize=13,
                  fontweight='bold', color='green')

    ax_zones.axhline(y=SEUIL_KAPLAN_FRANCIS, color='gray', linewidth=1.5)
    ax_zones.axhline(y=SEUIL_FRANCIS_PELTON, color='gray', linewidth=1.5)
    ax_zones.text(1.0, SEUIL_KAPLAN_FRANCIS, f' {SEUIL_KAPLAN_FRANCIS} m',
                  ha='right', va='bottom', fontsize=10, color='gray')
    ax_zones.text(1.0, SEUIL_FRANCIS_PELTON, f' {SEUIL_FRANCIS_PELTON} m',
                  ha='right', va='bottom', fontsize=10, color='gray')

    ax_zones.axhline(y=H_choisi, color=resultat['couleur'], linewidth=3,
                     linestyle='--', alpha=0.9)
    ax_zones.plot(0.5, H_choisi, 's', color=resultat['couleur'],
                  markersize=10, markeredgecolor='white', markeredgewidth=2, zorder=5)

    ax_zones.set_yscale('log')
    ax_zones.set_ylim(ax_main.get_ylim())
    ax_zones.set_xlim(0, 1)
    ax_zones.set_xticks([])
    ax_zones.set_yticks([])
    ax_zones.set_title('Zones de\nsélection', fontsize=14, fontweight='bold')

    plt.tight_layout()
    plt.show()

    return resultat


# =============================================================================
# 8. PROGRAMME PRINCIPAL
# =============================================================================

if __name__ == '__main__':
    N = 500
    Q = np.logspace(-0.6, 3.3, N)
    H = np.logspace(0.3, 3.6, N)

    plot_efficiency(Q, H)

    print("\n" + "=" * 65)
    print("   OUTIL DE SÉLECTION ET DIMENSIONNEMENT DE TURBINES  v2")
    print("=" * 65)
    print(f"\n  Centres empiriques HQ utilisés (centrales >= 200 MW) :")
    for nom, val in CENTRES_EMPIRIQUES_HQ.items():
        print(f"    • {nom:<10} : {val} m³/s / turbine")
    print(f"\n  Règle de classification par hauteur de chute H :")
    print(f"    • H < {SEUIL_KAPLAN_FRANCIS} m         → Kaplan   (basses chutes)")
    print(f"    • {SEUIL_KAPLAN_FRANCIS} ≤ H < {SEUIL_FRANCIS_PELTON} m  → Francis  (moyennes chutes)")
    print(f"    • H ≥ {SEUIL_FRANCIS_PELTON} m        → Pelton   (hautes chutes)")
    print()

    try:
        H_input = float(input("  Entrez la hauteur de chute H (en mètres) : "))
        if H_input <= 0:
            print("  La hauteur de chute doit être positive.")
        else:
            resultat = afficher_selection(H_input, Q, H)
            print(f"\n  Turbine recommandée : {resultat['nom']}")
            print(f"  Plage              : {resultat['plage']}")
            print(f"  Rendement max      : {resultat['turbine']['etamax']}")
            print(f"  Plage H supportée  : [{resultat['turbine']['Hmin']}, {resultat['turbine']['Hmax']}] m")
            print(f"  Plage Q/turbine    : [{resultat['turbine']['Qmin']}, {resultat['turbine']['Qmax']}] m³/s")
            print(f"  Centre empirique   : {CENTRES_EMPIRIQUES_HQ[resultat['nom']]} m³/s")

            print("\n" + "-" * 65)
            Q_input = float(input("  Entrez le débit total Q du barrage (en m³/s) : "))
            if Q_input <= 0:
                print("  Le débit total doit être positif.")
            else:
                resultat_nb = calculer_nombre_turbines(Q_input, resultat)
                afficher_resultats_nombre_turbines(H_input, resultat, resultat_nb)

    except ValueError:
        print("  Entrée invalide. Veuillez entrer un nombre.")
