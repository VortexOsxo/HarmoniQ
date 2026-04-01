import pandas as pd
import numpy as np

# data_solaire.py

# Définition des centrales solaires avec leurs puissances
coordinates_centrales = [
    (45.4167, -73.4999, "La Prairie", 0, "Etc/GMT+5", 8000),  # 8 MW = 8000 kW
    (45.6833, -73.4333, "Varennes", 0, "Etc/GMT+5", 1500),  # 1.5 MW = 1500 kW
]
coordinates_residential = [
    (48.4808, -68.5210, "Bas-Saint-Laurent", 0, "Etc/GMT+5"),
    (48.4284, -71.0683, "Saguenay-Lac-Saint-Jean", 0, "Etc/GMT+5"),
    (46.8139, -71.2082, "Capitale-Nationale", 0, "Etc/GMT+5"),
    (46.3420, -72.5477, "Mauricie", 0, "Etc/GMT+5"),
    (45.4036, -71.8826, "Estrie", 0, "Etc/GMT+5"),
    (45.5017, -73.5673, "Montreal", 0, "Etc/GMT+5"),
    (45.4215, -75.6919, "Outaouais", 0, "Etc/GMT+5"),
    (48.0703, -77.7600, "Abitibi-Temiscamingue", 0, "Etc/GMT+5"),
    (50.0340, -66.9141, "Cote-Nord", 0, "Etc/GMT+5"),
    (53.4667, -76.0000, "Nord-du-Quebec", 0, "Etc/GMT+5"),
    (48.8360, -64.4931, "Gaspesie-Iles-de-la-Madeleine", 0, "Etc/GMT+5"),
    (46.5000, -70.9000, "Chaudiere-Appalaches", 0, "Etc/GMT+5"),
    (45.6066, -73.7124, "Laval", 0, "Etc/GMT+5"),
    (46.0270, -73.4360, "Lanaudiere", 0, "Etc/GMT+5"),
    (45.9990, -74.1428, "Laurentides", 0, "Etc/GMT+5"),
    (45.4500, -73.3496, "Monteregie", 0, "Etc/GMT+5"),
    (46.4043, -72.0169, "Centre-du-Quebec", 0, "Etc/GMT+5"),
]


coordinates_residential_MRC = [
    (45.4163, -72.6524, "La Haute-Yamaska", 0, "Etc/GMT+5"),
    (45.6210, -72.5373, "Acton", 0, "Etc/GMT+5"),
    (45.8576, -72.4707, "Drummond", 0, "Etc/GMT+5"),
    (46.1254, -72.5347, "Nicolet-Yamaska", 0, "Etc/GMT+5"),
    (46.5285, -73.0870, "Maskinongé", 0, "Etc/GMT+5"),
    (46.2360, -73.2958, "D'Autray", 0, "Etc/GMT+5"),
    (45.9643, -72.9981, "Pierre-De Saurel", 0, "Etc/GMT+5"),
    (45.6718, -72.9071, "Les Maskoutains", 0, "Etc/GMT+5"),
    (45.4133, -73.0326, "Rouville", 0, "Etc/GMT+5"),
    (45.2144, -73.2298, "Le Haut-Richelieu", 0, "Etc/GMT+5"),
    (45.6159, -73.2013, "La Vallée-du-Richelieu", 0, "Etc/GMT+5"),
    (45.5230, -73.4204, "Longueuil", 0, "Etc/GMT+5"),
    (45.7193, -73.3201, "Marguerite-D'Youville", 0, "Etc/GMT+5"),
    (45.8278, -73.4471, "L'Assomption", 0, "Etc/GMT+5"),
    (46.0499, -73.4528, "Joliette", 0, "Etc/GMT+5"),
    (46.7900, -74.0436, "Matawinie", 0, "Etc/GMT+5"),
    (45.9244, -73.7035, "Montcalm", 0, "Etc/GMT+5"),
    (45.7467, -73.6552, "Les Moulins", 0, "Etc/GMT+5"),
    (45.6048, -73.7258, "Laval", 0, "Etc/GMT+5"),
    (45.5166, -73.6836, "Montréal", 0, "Etc/GMT+5"),
    (45.3465, -73.6039, "Roussillon", 0, "Etc/GMT+5"),
    (45.1555, -73.5360, "Les Jardins-de-Napierville", 0, "Etc/GMT+5"),
    (45.0800, -74.0788, "Le Haut-Saint-Laurent", 0, "Etc/GMT+5"),
    (45.2363, -73.9436, "Beauharnois-Salaberry", 0, "Etc/GMT+5"),
    (45.3687, -74.2409, "Vaudreuil-Soulanges", 0, "Etc/GMT+5"),
    (45.5358, -74.0352, "Deux-Montagnes", 0, "Etc/GMT+5"),
    (45.7055, -73.8326, "Thérèse-De Blainville", 0, "Etc/GMT+5"),
    (45.6520, -74.0598, "Mirabel", 0, "Etc/GMT+5"),
    (45.8331, -74.0206, "La Rivière-du-Nord", 0, "Etc/GMT+5"),
    (45.7296, -74.4824, "Argenteuil", 0, "Etc/GMT+5"),
    (45.9295, -74.2552, "Les Pays-d'en-Haut", 0, "Etc/GMT+5"),
    (46.1547, -74.5769, "Les Laurentides", 0, "Etc/GMT+5"),
    (46.8964, -75.1864, "Antoine-Labelle", 0, "Etc/GMT+5"),
    (45.8581, -75.1707, "Papineau", 0, "Etc/GMT+5"),
    (45.4910, -75.6583, "Gatineau", 0, "Etc/GMT+5"),
    (45.6494, -75.8741, "Les Collines-de-l'Outaouais", 0, "Etc/GMT+5"),
    (46.9060, -76.1618, "La Vallée-de-la-Gatineau", 0, "Etc/GMT+5"),
    (46.4253, -77.0937, "Pontiac", 0, "Etc/GMT+5"),
    (47.1296, -78.5606, "Témiscamingue", 0, "Etc/GMT+5"),
    (48.1326, -78.8731, "Rouyn-Noranda", 0, "Etc/GMT+5"),
    (48.7472, -79.1116, "Abitibi-Ouest", 0, "Etc/GMT+5"),
    (48.6734, -77.9328, "Abitibi", 0, "Etc/GMT+5"),
    (48.1510, -76.7571, "La Vallée-de-l'Or", 0, "Etc/GMT+5"),
    (48.0455, -73.9817, "La Tuque", 0, "Etc/GMT+5"),
    (48.8157, -73.2630, "Le Domaine-du-Roy", 0, "Etc/GMT+5"),
    (49.9864, -72.2671, "Maria-Chapdelaine", 0, "Etc/GMT+5"),
    (48.4137, -71.7419, "Lac-Saint-Jean-Est", 0, "Etc/GMT+5"),
    (50.1103, -70.6755, "Le Saguenay-et-son-Fjord", 0, "Etc/GMT+5"),
    (49.0808, -69.5685, "La Haute-Côte-Nord", 0, "Etc/GMT+5"),
    (50.4135, -68.7516, "Manicouagan", 0, "Etc/GMT+5"),
    (52.6142, -67.8369, "Sept-Rivières--Caniapiscau", 0, "Etc/GMT+5"),
    (51.0745, -61.9286, "Minganie--Le Golfe-du-Saint-Laurent", 0, "Etc/GMT+5"),
    (55.9711, -73.0069, "Nord-du-Québec", 0, "Etc/GMT+5"),
    (47.4026, -61.7973, "Les Îles-de-la-Madeleine", 0, "Etc/GMT+5"),
    (48.5003, -64.8015, "Le Rocher-Percé", 0, "Etc/GMT+5"),
    (48.9082, -64.9187, "La Côte-de-Gaspé", 0, "Etc/GMT+5"),
    (48.9707, -65.9382, "La Haute-Gaspésie", 0, "Etc/GMT+5"),
    (48.3401, -65.5964, "Bonaventure", 0, "Etc/GMT+5"),
    (48.1495, -66.7832, "Avignon", 0, "Etc/GMT+5"),
    (48.4467, -67.0889, "La Matapédia", 0, "Etc/GMT+5"),
    (48.7811, -67.0063, "Matane", 0, "Etc/GMT+5"),
    (48.3358, -67.9680, "La Mitis", 0, "Etc/GMT+5"),
    (48.1913, -68.4291, "Rimouski-Neigette", 0, "Etc/GMT+5"),
    (48.0580, -68.9712, "Les Basques", 0, "Etc/GMT+5"),
    (47.8488, -69.2948, "Rivière-du-Loup", 0, "Etc/GMT+5"),
    (47.6296, -68.8645, "Témiscouata", 0, "Etc/GMT+5"),
    (47.4198, -69.6923, "Kamouraska", 0, "Etc/GMT+5"),
    (47.8689, -70.1585, "Charlevoix-Est", 0, "Etc/GMT+5"),
    (47.6905, -70.7904, "Charlevoix", 0, "Etc/GMT+5"),
    (47.0546, -70.0250, "L'Islet", 0, "Etc/GMT+5"),
    (46.8113, -70.3302, "Montmagny", 0, "Etc/GMT+5"),
    (46.6719, -70.7458, "Bellechasse", 0, "Etc/GMT+5"),
    (46.9329, -70.9582, "L'Île-d'Orléans", 0, "Etc/GMT+5"),
    (47.4973, -71.2959, "La Côte-de-Beaupré", 0, "Etc/GMT+5"),
    (47.2798, -71.6666, "La Jacques-Cartier", 0, "Etc/GMT+5"),
    (46.8390, -71.3601, "Québec", 0, "Etc/GMT+5"),
    (46.7066, -71.2359, "Lévis", 0, "Etc/GMT+5"),
    (46.4873, -71.0104, "La Nouvelle-Beauce", 0, "Etc/GMT+5"),
    (46.2646, -70.8512, "Robert-Cliche", 0, "Etc/GMT+5"),
    (46.3668, -70.3689, "Les Etchemins", 0, "Etc/GMT+5"),
    (45.9754, -70.6591, "Beauce-Sartigan", 0, "Etc/GMT+5"),
    (45.6271, -70.9291, "Le Granit", 0, "Etc/GMT+5"),
    (46.0655, -71.2996, "Les Appalaches", 0, "Etc/GMT+5"),
    (46.2536, -71.7021, "L'Érable", 0, "Etc/GMT+5"),
    (46.4948, -71.5497, "Lotbinière", 0, "Etc/GMT+5"),
    (47.0115, -72.0398, "Portneuf", 0, "Etc/GMT+5"),
    (47.0440, -73.1377, "Mékinac", 0, "Etc/GMT+5"),
    (46.7118, -72.8817, "Shawinigan", 0, "Etc/GMT+5"),
    (46.5038, -72.4677, "Francheville", 0, "Etc/GMT+5"),
    (46.3596, -72.1996, "Bécancour", 0, "Etc/GMT+5"),
    (45.9994, -71.9431, "Arthabaska", 0, "Etc/GMT+5"),
    (45.7494, -71.7976, "Les Sources", 0, "Etc/GMT+5"),
    (45.4740, -71.4553, "Le Haut-Saint-François", 0, "Etc/GMT+5"),
    (45.5547, -72.0894, "Le Val-Saint-François", 0, "Etc/GMT+5"),
    (45.4016, -71.9617, "Sherbrooke", 0, "Etc/GMT+5"),
    (45.1427, -71.7521, "Coaticook", 0, "Etc/GMT+5"),
    (45.2069, -72.2198, "Memphrémagog", 0, "Etc/GMT+5"),
    (45.1679, -72.7572, "Brome-Missisquoi", 0, "Etc/GMT+5"),
]

population_relative = {
    "Bas-Saint-Laurent": 0.0226,
    "Saguenay-Lac-Saint-Jean": 0.0316,
    "Capitale-Nationale": 0.0899,
    "Mauricie": 0.0320,
    "Estrie": 0.0582,
    "Montreal": 0.2398,
    "Outaouais": 0.0473,
    "Abitibi-Temiscamingue": 0.0165,
    "Cote-Nord": 0.0099,
    "Nord-du-Quebec": 0.0052,
    "Gaspesie-Iles-de-la-Madeleine": 0.0102,
    "Chaudiere-Appalaches": 0.0507,
    "Laval": 0.0509,
    "Lanaudiere": 0.0629,
    "Laurentides": 0.0750,
    "Monteregie": 0.1681,
    "Centre-du-Quebec": 0.0292,
}


# ===========================================================================
#  FACTEUR TOITURE PAR RA
# ---------------------------------------------------------------------------
#  Surface de toit utilisable par habitant (m²/hab).
#  Formule : S_toit_util = (S_hab_par_hab / N_étages) × η_toit
#
#  Sources / hypothèses :
#    S_hab_par_hab : ~35-50 m²/hab selon le type de bâti régional

#    N_étages      : estimé par paliers de densité (hab/km²)
#                    < 100 → 1.5  |  100-1000 → 2.0  |  1000-3000 → 3.0
#                    3000-5000 → 4.5  |  > 5000 → 7.0

# https://oee.nrcan.gc.ca/organisme/statistiques/bnce/apd/showTable.cfm?type=SHCMA&sector=aaa&juris=ca&year=2015&rn=9&page=1

#    η_toit = 0.35 : orientation, ombrage, HVAC, pente, neige
#
#  Le facteur toiture F_toit est calculé dynamiquement dans
#  calculs_production_solaire.py en fonction du scénario :
#    F_toit = min(S_toit_util / surface_panneau, panneaux_scenario) / panneaux_scenario
# ===========================================================================
surface_toit_utilisable_par_hab = {
    "Bas-Saint-Laurent":              9.33,
    "Saguenay-Lac-Saint-Jean":        9.80,
    "Capitale-Nationale":             8.87,
    "Mauricie":                       9.33,
    "Estrie":                         9.33,
    "Montreal":                       2.18,
    "Outaouais":                      8.87,
    "Abitibi-Temiscamingue":         10.50,
    "Cote-Nord":                     10.50,
    "Nord-du-Quebec":                11.67,
    "Gaspesie-Iles-de-la-Madeleine":  9.80,
    "Chaudiere-Appalaches":           9.80,
    "Laval":                          3.73,
    "Lanaudiere":                     8.87,
    "Laurentides":                    8.87,
    "Monteregie":                     6.30,
    "Centre-du-Quebec":               9.80,
}

# ===========================================================================
#  MAPPING MRC → RA
# ---------------------------------------------------------------------------
#  Clés = noms exacts de coordinates_residential_MRC
#  Valeurs = noms exacts de coordinates_residential / population_relative
#
#  Notes :
#   - "Le Saguenay-et-son-Fjord" regroupe Saguenay + Le Fjord-du-Saguenay
#   - "Sept-Rivières--Caniapiscau" regroupe 2 MRC ISQ
#   - "Minganie--Le Golfe-du-Saint-Laurent" regroupe 2 MRC ISQ
#   - "Nord-du-Québec" regroupe Jamésie + Kativik + Eeyou Istchee
#   - "Francheville" = ancien nom (Trois-Rivières + Les Chenaux)
#   - "Robert-Cliche" = ancien nom (Beauce-Centre)
#   - "Matane" = La Matanie (ISQ)
# ===========================================================================
mrc_to_ra = {
    # --- Bas-Saint-Laurent ---
    "La Matapédia":           "Bas-Saint-Laurent",
    "Matane":                 "Bas-Saint-Laurent",
    "La Mitis":               "Bas-Saint-Laurent",
    "Rimouski-Neigette":      "Bas-Saint-Laurent",
    "Les Basques":            "Bas-Saint-Laurent",
    "Rivière-du-Loup":        "Bas-Saint-Laurent",
    "Témiscouata":            "Bas-Saint-Laurent",
    "Kamouraska":             "Bas-Saint-Laurent",
    # --- Saguenay–Lac-Saint-Jean ---
    "Le Domaine-du-Roy":         "Saguenay-Lac-Saint-Jean",
    "Maria-Chapdelaine":         "Saguenay-Lac-Saint-Jean",
    "Lac-Saint-Jean-Est":        "Saguenay-Lac-Saint-Jean",
    "Le Saguenay-et-son-Fjord":  "Saguenay-Lac-Saint-Jean",
    # --- Capitale-Nationale ---
    "Charlevoix-Est":         "Capitale-Nationale",
    "Charlevoix":             "Capitale-Nationale",
    "L'Île-d'Orléans":        "Capitale-Nationale",
    "La Côte-de-Beaupré":     "Capitale-Nationale",
    "La Jacques-Cartier":     "Capitale-Nationale",
    "Québec":                 "Capitale-Nationale",
    "Portneuf":               "Capitale-Nationale",
    # --- Mauricie ---
    "Mékinac":                "Mauricie",
    "Shawinigan":             "Mauricie",
    "Francheville":           "Mauricie",
    "Maskinongé":             "Mauricie",
    "La Tuque":               "Mauricie",
    # --- Estrie ---
    "Le Granit":              "Estrie",
    "Les Sources":            "Estrie",
    "Le Haut-Saint-François": "Estrie",
    "Le Val-Saint-François":  "Estrie",
    "Sherbrooke":             "Estrie",
    "Coaticook":              "Estrie",
    "Memphrémagog":           "Estrie",
    "Brome-Missisquoi":       "Estrie",
    "La Haute-Yamaska":       "Estrie",
    # --- Montréal ---
    "Montréal":               "Montreal",
    # --- Outaouais ---
    "Papineau":                       "Outaouais",
    "Gatineau":                       "Outaouais",
    "Les Collines-de-l'Outaouais":    "Outaouais",
    "La Vallée-de-la-Gatineau":       "Outaouais",
    "Pontiac":                        "Outaouais",
    # --- Abitibi-Témiscamingue ---
    "Témiscamingue":          "Abitibi-Temiscamingue",
    "Rouyn-Noranda":          "Abitibi-Temiscamingue",
    "Abitibi-Ouest":          "Abitibi-Temiscamingue",
    "Abitibi":                "Abitibi-Temiscamingue",
    "La Vallée-de-l'Or":      "Abitibi-Temiscamingue",
    # --- Côte-Nord ---
    "La Haute-Côte-Nord":                   "Cote-Nord",
    "Manicouagan":                          "Cote-Nord",
    "Sept-Rivières--Caniapiscau":           "Cote-Nord",
    "Minganie--Le Golfe-du-Saint-Laurent":  "Cote-Nord",
    # --- Nord-du-Québec ---
    "Nord-du-Québec":         "Nord-du-Quebec",
    # --- Gaspésie–Îles-de-la-Madeleine ---
    "Les Îles-de-la-Madeleine":  "Gaspesie–Iles-de-la-Madeleine",
    "Le Rocher-Percé":           "Gaspesie–Iles-de-la-Madeleine",
    "La Côte-de-Gaspé":          "Gaspesie–Iles-de-la-Madeleine",
    "La Haute-Gaspésie":         "Gaspesie–Iles-de-la-Madeleine",
    "Bonaventure":               "Gaspesie–Iles-de-la-Madeleine",
    "Avignon":                   "Gaspesie–Iles-de-la-Madeleine",
    # --- Chaudière-Appalaches ---
    "L'Islet":                "Chaudiere-Appalaches",
    "Montmagny":              "Chaudiere-Appalaches",
    "Bellechasse":            "Chaudiere-Appalaches",
    "Lévis":                  "Chaudiere-Appalaches",
    "La Nouvelle-Beauce":     "Chaudiere-Appalaches",
    "Robert-Cliche":          "Chaudiere-Appalaches",
    "Les Etchemins":          "Chaudiere-Appalaches",
    "Beauce-Sartigan":        "Chaudiere-Appalaches",
    "Les Appalaches":         "Chaudiere-Appalaches",
    "Lotbinière":             "Chaudiere-Appalaches",
    # --- Laval ---
    "Laval":                  "Laval",
    # --- Lanaudière ---
    "D'Autray":               "Lanaudiere",
    "L'Assomption":           "Lanaudiere",
    "Joliette":               "Lanaudiere",
    "Matawinie":              "Lanaudiere",
    "Montcalm":               "Lanaudiere",
    "Les Moulins":            "Lanaudiere",
    # --- Laurentides ---
    "Deux-Montagnes":         "Laurentides",
    "Thérèse-De Blainville":  "Laurentides",
    "Mirabel":                "Laurentides",
    "La Rivière-du-Nord":     "Laurentides",
    "Argenteuil":             "Laurentides",
    "Les Pays-d'en-Haut":     "Laurentides",
    "Les Laurentides":        "Laurentides",
    "Antoine-Labelle":        "Laurentides",
    # --- Montérégie ---
    "Acton":                         "Monteregie",
    "Pierre-De Saurel":              "Monteregie",
    "Les Maskoutains":               "Monteregie",
    "Rouville":                      "Monteregie",
    "Le Haut-Richelieu":             "Monteregie",
    "La Vallée-du-Richelieu":        "Monteregie",
    "Longueuil":                     "Monteregie",
    "Marguerite-D'Youville":         "Monteregie",
    "Roussillon":                    "Monteregie",
    "Les Jardins-de-Napierville":    "Monteregie",
    "Le Haut-Saint-Laurent":         "Monteregie",
    "Beauharnois-Salaberry":         "Monteregie",
    "Vaudreuil-Soulanges":           "Monteregie",
    # --- Centre-du-Québec ---
    "L'Érable":               "Centre-du-Quebec",
    "Bécancour":              "Centre-du-Quebec",
    "Arthabaska":             "Centre-du-Quebec",
    "Drummond":               "Centre-du-Quebec",
    "Nicolet-Yamaska":        "Centre-du-Quebec",
}

# ===========================================================================
#  POPULATION RELATIVE PAR MRC  (F_intra = pop_MRC / pop_RA)
# ---------------------------------------------------------------------------
#  Source : ISQ, estimations au 1er juillet 2025
#  Clés = noms exacts de coordinates_residential_MRC
#  Les MRC fusionnées cumulent les populations ISQ :
#   - Le Saguenay-et-son-Fjord = Saguenay + Le Fjord-du-Saguenay
#   - Sept-Rivières--Caniapiscau = Sept-Rivières + Caniapiscau
#   - Minganie--Le Golfe-du-St-Laurent = Minganie + Le Golfe-du-St-Laurent
#   - Nord-du-Québec = Jamésie + Kativik + Eeyou Istchee
#   - Francheville = Trois-Rivières + Les Chenaux
# ===========================================================================
population_relative_MRC = {
    # --- Bas-Saint-Laurent (pop RA = 204 755) ---
    "La Matapédia":           0.08683,
    "Matane":                 0.10345,
    "La Mitis":               0.09058,
    "Rimouski-Neigette":      0.29435,
    "Les Basques":            0.04383,
    "Rivière-du-Loup":        0.17797,
    "Témiscouata":            0.09787,
    "Kamouraska":             0.10513,
    # --- Saguenay–Lac-Saint-Jean (pop RA = 286 395) ---
    "Le Domaine-du-Roy":         0.10929,
    "Maria-Chapdelaine":         0.08496,
    "Lac-Saint-Jean-Est":        0.18795,
    "Le Saguenay-et-son-Fjord":  0.61780,   # Saguenay + Le Fjord
    # --- Capitale-Nationale (pop RA = 814 004) ---
    "Charlevoix-Est":         0.01904,
    "Charlevoix":             0.01757,
    "L'Île-d'Orléans":        0.00829,
    "La Côte-de-Beaupré":     0.04016,
    "La Jacques-Cartier":     0.06349,
    "Québec":                 0.77872,
    "Portneuf":               0.07272,
    # --- Mauricie (pop RA = 289 722) ---
    "Mékinac":                0.04548,
    "Shawinigan":             0.17858,
    "Francheville":           0.58827,   # Trois-Rivières + Les Chenaux
    "Maskinongé":             0.13389,
    "La Tuque":               0.05379,
    # --- Estrie (pop RA = 527 340) ---
    "Le Granit":              0.04148,
    "Les Sources":            0.02862,
    "Le Haut-Saint-François": 0.04617,
    "Le Val-Saint-François":  0.06327,
    "Sherbrooke":             0.34918,
    "Coaticook":              0.03732,
    "Memphrémagog":           0.11412,
    "Brome-Missisquoi":       0.13351,
    "La Haute-Yamaska":       0.18632,
    # --- Montréal (pop RA = 2 172 259) ---
    "Montréal":               1.00000,
    # --- Outaouais (pop RA = 428 751) ---
    "Papineau":                       0.06329,
    "Gatineau":                       0.71395,
    "Les Collines-de-l'Outaouais":    0.13691,
    "La Vallée-de-la-Gatineau":       0.05090,
    "Pontiac":                        0.03496,
    # --- Abitibi-Témiscamingue (pop RA = 149 441) ---
    "Témiscamingue":          0.10850,
    "Rouyn-Noranda":          0.28955,
    "Abitibi-Ouest":          0.13662,
    "Abitibi":                0.16841,
    "La Vallée-de-l'Or":      0.29692,
    # --- Côte-Nord (pop RA = 89 621) ---
    "La Haute-Côte-Nord":                   0.11210,
    "Manicouagan":                          0.33663,
    "Sept-Rivières--Caniapiscau":           0.42618,   # Sept-Rivières + Caniapiscau
    "Minganie--Le Golfe-du-Saint-Laurent":  0.12508,   # Minganie + Le Golfe
    # --- Nord-du-Québec (pop RA = 47 541) ---
    "Nord-du-Québec":         1.00000,   # Jamésie + Kativik + Eeyou Istchee
    # --- Gaspésie–Îles-de-la-Madeleine (pop RA = 92 084) ---
    "Les Îles-de-la-Madeleine":  0.13991,
    "Le Rocher-Percé":           0.18516,
    "La Côte-de-Gaspé":          0.19492,
    "La Haute-Gaspésie":         0.11883,
    "Bonaventure":               0.19576,
    "Avignon":                   0.16544,
    # --- Chaudière-Appalaches (pop RA = 459 158) ---
    "L'Islet":                0.03879,
    "Montmagny":              0.05006,
    "Bellechasse":            0.08624,
    "Lévis":                  0.35038,
    "La Nouvelle-Beauce":     0.08943,
    "Robert-Cliche":          0.04353,
    "Les Etchemins":          0.03844,
    "Beauce-Sartigan":        0.12230,
    "Les Appalaches":         0.09857,
    "Lotbinière":             0.08225,
    # --- Laval (pop RA = 461 509) ---
    "Laval":                  1.00000,
    # --- Lanaudière (pop RA = 569 335) ---
    "D'Autray":               0.08364,
    "L'Assomption":           0.23897,
    "Joliette":               0.13262,
    "Matawinie":              0.10710,
    "Montcalm":               0.11489,
    "Les Moulins":            0.32278,
    # --- Laurentides (pop RA = 679 190) ---
    "Deux-Montagnes":         0.16163,
    "Thérèse-De Blainville":  0.24928,
    "Mirabel":                0.10081,
    "La Rivière-du-Nord":     0.22163,
    "Argenteuil":             0.05664,
    "Les Pays-d'en-Haut":     0.07403,
    "Les Laurentides":        0.07975,
    "Antoine-Labelle":        0.05621,
    # --- Montérégie (pop RA = 1 522 372) ---
    "Acton":                         0.01076,
    "Pierre-De Saurel":              0.03554,
    "Les Maskoutains":               0.06206,
    "Rouville":                      0.02588,
    "Le Haut-Richelieu":             0.08259,
    "La Vallée-du-Richelieu":        0.08979,
    "Longueuil":                     0.30096,
    "Marguerite-D'Youville":         0.05494,
    "Roussillon":                    0.13695,
    "Les Jardins-de-Napierville":    0.02143,
    "Le Haut-Saint-Laurent":         0.01748,
    "Beauharnois-Salaberry":        0.04953,
    "Vaudreuil-Soulanges":           0.11209,
    # --- Centre-du-Québec (pop RA = 264 820) ---
    "L'Érable":               0.09270,
    "Bécancour":              0.08470,
    "Arthabaska":             0.29319,
    "Drummond":               0.43689,
    "Nicolet-Yamaska":        0.09252,
}