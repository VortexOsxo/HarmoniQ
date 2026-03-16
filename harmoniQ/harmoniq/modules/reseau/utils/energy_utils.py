import numpy as np
import pandas as pd
import logging
import pypsa

logger = logging.getLogger("EnergyUtils")

class EnergyUtils:
    """
    Classe utilitaire pour les calculs énergétiques du réseau électrique.
    
    Fournit des méthodes pour la gestion des réservoirs, le calcul des coûts,
    et l'estimation de la production d'énergie.
    """
    
    @staticmethod
    def obtenir_energie_historique(annee: str) -> float:
        """
        Récupère l'énergie historique produite.
        
        Args: annee: Année des données historiques   
        Returns: float: Énergie historique en MWh
        """
        energie_historique = {
            "2022": 210.8e6,  # TWh en MWh
            "2023": 205.2e6,
            "2024": 208.0e6 
        }
        
        if annee in energie_historique:
            return energie_historique[annee]
        
        return sum(energie_historique.values()) / len(energie_historique)


    @staticmethod
    def estimer_production_annuelle(centrale) -> float:
        """
        Estime la production annuelle d'une centrale.
        
        Args:
            centrale: Générateur PyPSA
            
        Returns:
            float: Production annuelle estimée en MWh
        """
        facteurs_capacite = {
            "hydro_fil": 0.5,
            "hydro_reservoir": 0.55,
            "eolien": 0.35,
            "solaire": 0.18,
            "thermique": 0.85,
            "nucléaire": 0.90
        }
        
        puissance_nominale = centrale.p_nom
        facteur = facteurs_capacite.get(centrale.carrier, 0.5)
        return puissance_nominale * facteur * 8760  # heures dans une année
    
    @staticmethod
    def obtenir_bus_frontiere(reseau, type_bus: str) -> str:
        """
        Obtient le bus frontière pour les interconnexions.
        
        Args:
            reseau: Réseau PyPSA
            type_bus: Type de bus recherché
            
        Returns:
            str: Identifiant du bus frontière
        """
        bus_interconnexion = "Stanstead"
        
        if bus_interconnexion in reseau.buses.index:
            return bus_interconnexion
        
        logger.warning(f"Bus {bus_interconnexion} non trouvé, utilisation du premier bus disponible")
        return reseau.buses.index[0]

    
    @staticmethod
    def calcul_cout_reservoir_vectorized(niveaux: np.ndarray) -> np.ndarray:
        """
        Calcule le coût marginal en fonction du niveau du réservoir (version vectorisée).
        
        Args:
            niveaux: Array numpy de niveaux de réservoir (0-1)
            
        Returns:
            np.ndarray: Coûts marginaux calculés
        """
        cout_minimum = 5.0     # Coût quand le réservoir est plein
        cout_maximum = 35.0    # Coût quand le réservoir est presque vide
        niveau_critique = 0.25
        
        niveaux = np.clip(niveaux, 0, 1)
        
        couts = np.zeros_like(niveaux, dtype=np.float64)
        
        below_critical = niveaux < niveau_critique
        
        facteur_below = (niveau_critique - niveaux[below_critical]) / niveau_critique
        couts[below_critical] = cout_minimum + (cout_maximum - cout_minimum) * np.exp(2 * facteur_below)
        
        above_critical = ~below_critical
        facteur_above = (1 - niveaux[above_critical]) / (1 - niveau_critique)
        couts[above_critical] = cout_minimum + (cout_maximum/4 - cout_minimum) * facteur_above
        
        return np.round(couts, 2)
        
    @staticmethod
    def generer_faux_niveaux_reservoirs(snapshots, barrages_reservoir, seed=None):
        """
        Génère des niveaux de réservoirs simulés (version optimisée).
        
        Args:
            snapshots: DatetimeIndex avec les pas de temps du scénario
            barrages_reservoir: Liste des noms des barrages à simuler
            seed: Graine pour la reproduction des résultats (optionnel)
            
        Returns:
            pd.DataFrame: Niveaux des réservoirs simulés (0-1)
        """
        if seed is not None:
            np.random.seed(seed)
        
        n_snapshots = len(snapshots)
        n_barrages = len(barrages_reservoir)
        
        mois = pd.DatetimeIndex(snapshots).month.values
        saisonnalite = np.sin((mois - 3) * np.pi / 6) * 0.2
        
        # Niveau initial entre 0.4 et 0.8
        niveaux_initiaux = np.random.uniform(0.4, 0.8, size=n_barrages)
        
         # Variations aléatoires et saisonnalité
        variations = np.random.normal(0, 0.01, size=(n_snapshots, n_barrages))
        
        niveaux = niveaux_initiaux + np.cumsum(variations, axis=0)
        
        niveaux = niveaux + saisonnalite[:, np.newaxis]
        
        niveaux = np.clip(niveaux, 0.1, 1.0)
        
        niveaux_df = pd.DataFrame(niveaux, index=snapshots, columns=barrages_reservoir)
        
        return niveaux_df
    
    @staticmethod
    def ajouter_interconnexion_import_export(network, Pmax, bus_frontiere=None):
        """
        Ajoute une interconnexion d'import/export au réseau.
        
        Args:
            network: Réseau PyPSA
            Pmax: Capacité maximale d'import/export en MW
            bus_frontiere: Bus frontière (optionnel)
            
        Returns:
            pypsa.Network: Réseau mis à jour
        """
        if bus_frontiere is None:
            bus_frontiere = EnergyUtils.obtenir_bus_frontiere(network, "Interconnexion")
            
        if bus_frontiere not in network.buses.index:
            return network
            
        if Pmax >= 0:
            network.add(
                "Generator",
                f"import_{bus_frontiere}",
                bus=bus_frontiere,
                p_nom=Pmax,
                marginal_cost=0.5,
                carrier="import"
            )
        else:
            network.add(
                "Load",
                f"export_{bus_frontiere}",
                bus=bus_frontiere,
                p_set=0,
                carrier="export"
            )
            
            if not hasattr(network, 'loads_t'):
                network.loads_t = pypsa.descriptors.Dict({})
            if not hasattr(network.loads_t, 'p_max'):
                network.loads_t.p_max = pd.DataFrame(index=network.snapshots)
                
            network.loads_t.p_max[f"export_{bus_frontiere}"] = Pmax
        
        return network

    @staticmethod
    def reechantillonner_reseau_journalier(network):
        """
        Réechantillonne les données temporelles du réseau à une fréquence journalière.
        
        Cette méthode convertit les séries temporelles du réseau en données journalières:
        - Somme les consommations (loads) pour obtenir l'énergie totale par jour
        - Calcule la moyenne pour les autres séries temporelles
        
        Args:
            network: Réseau PyPSA à réechantillonner
            
        Returns:
            pypsa.Network: Réseau avec données temporelles réechantillonnées
        """
        if len(network.snapshots) <= 1:
            logger.warning("Pas assez de données temporelles pour réechantillonner")
            return network
        
        logger.info(f"Réechantillonnage de {len(network.snapshots)} pas de temps à fréquence journalière")
        
        new_network = pypsa.Network()
        
        # Liste des composants statiques
        component_types = [
            "buses", "carriers", "generators", "loads", "stores", "storage_units",
            "lines", "transformers", "links", "generator_t", "load_t", "line_types"
        ]
        
        for component_name in component_types:
            if hasattr(network, component_name):
                component_df = getattr(network, component_name)
                if isinstance(component_df, pd.DataFrame) and not component_df.empty:
                    setattr(new_network, component_name, component_df.copy())
        
        # Déterminer les snapshots journaliers (midi comme représentant)
        daily_snapshots = pd.DatetimeIndex([ts.replace(hour=12, minute=0, second=0) 
                                     for ts in pd.to_datetime(network.snapshots).floor('D').unique()])
        new_network.set_snapshots(daily_snapshots)
        
        for component_name in component_types:
            component_t_name = f"{component_name}_t"
            
            if not hasattr(network, component_t_name):
                continue
            
            component_t = getattr(network, component_t_name)
            
            # Pour les DataFrames simples
            if not isinstance(component_t, dict):
                if not isinstance(component_t, pd.DataFrame) or component_t.empty:
                    continue
                    
                df = component_t
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)

                resampled_df = df.resample('D').sum() if component_name == "loads" else df.resample('D').mean()
                resampled_df.index = daily_snapshots[:len(resampled_df)]
                setattr(new_network, component_t_name, resampled_df)
                
            # Pour les dictionnaires de DataFrames
            else:
                for attr, df in component_t.items():
                    if df.empty:
                        continue
                    
                    if not isinstance(df.index, pd.DatetimeIndex):
                        df.index = pd.to_datetime(df.index)
                    
                    # Somme pour les consommations (p_set), moyenne pour le reste
                    use_sum = component_name == "loads" and attr == "p_set"
                    resampled_df = df.resample('D').sum() if use_sum else df.resample('D').mean()
                    resampled_df.index = daily_snapshots[:len(resampled_df)]
                    
                    # CORRECTION: Marquer les données de charge (p_set) comme étant en énergie et non en puissance
                    if use_sum:
                        # Ajouter un attribut pour indiquer que les données sont en MWh/jour (énergie) et non en MW (puissance)
                        resampled_df._energy_not_power = True
                        logger.info(f"Données de charge (p_set) marquées comme ÉNERGIE (MWh/jour) et non puissance (MW)")
                    
                    # Créer le dictionnaire si nécessaire
                    if not hasattr(new_network, component_t_name):
                        setattr(new_network, component_t_name, pypsa.descriptors.Dict({}))
                    
                    getattr(new_network, component_t_name)[attr] = resampled_df
        
        logger.info(f"Réechantillonnage terminé: {len(daily_snapshots)} jours")
        return new_network

    @staticmethod
    def ensure_network_solvability(network, reference_bus=None):
        """
        Assure la solvabilité du réseau en créant une topologie complètement connectée
        et en ajoutant suffisamment de capacité de génération.
        
        Cette méthode:
        1. Ajoute des lignes virtuelles pour connecter tous les composants
        2. Assure que chaque bus avec charge a accès à un générateur
        3. Vérifie que la capacité de génération est suffisante à chaque pas de temps
        
        Args:
            network: Réseau PyPSA à modifier
            reference_bus: Bus de référence pour les connexions (optionnel)
            
        Returns:
            pypsa.Network: Réseau modifié pour assurer la solvabilité
        """
        import networkx as nx
        import numpy as np

        EnergyUtils.align_time_indexes(network)

        G = nx.Graph()
        for bus in network.buses.index:
            G.add_node(bus)
            
        for _, line in network.lines.iterrows():
            G.add_edge(line.bus0, line.bus1)
        
        components = list(nx.connected_components(G))
        logger.info(f"Réseau avec {len(components)} composants non connectés")
        
        if reference_bus is None:
            buses_with_load = set(network.loads.bus)
            buses_with_gen = set(network.generators.bus)
            common_buses = buses_with_load.intersection(buses_with_gen)
            
            if common_buses:
                reference_bus = list(common_buses)[0]
            elif len(buses_with_gen) > 0:
                reference_bus = list(buses_with_gen)[0]
            else:
                reference_bus = network.buses.index[0]

        if "virtual_line_type" not in network.line_types.index:
            network.add(
                "LineType",
                "virtual_line_type",
                r=0.001,  
                x=0.01,
                b=0,   
                s_nom=1000000
            )
        
        if len(components) > 1:
            
            # Pour chaque composant, connecter un bus au bus de référence
            for i, comp in enumerate(components):
                if reference_bus in comp:
                    continue  # Sauter le composant qui contient déjà le bus de référence
                
                comp_bus = list(comp)[0]  # Premier bus du composant
                
                line_name = f"virtual_full_mesh_line_{i}"
                if line_name not in network.lines.index:
                    network.add(
                        "Line",
                        line_name,
                        bus0=reference_bus,
                        bus1=comp_bus,
                        type="virtual_line_type",
                        s_nom=1000000
                    )
    
        if hasattr(network.generators_t, 'p_max_pu'):
            snapshots = network.snapshots

            if not network.loads_t.p_set.empty:
                total_demand = (
                    network.loads_t.p_set
                    .reindex(snapshots)
                    .fillna(network.loads_t.p_set.mean())
                    .sum(axis=1)
                )
            else:
                total_demand = pd.Series(0.0, index=snapshots)

            p_nom = network.generators['p_nom']
            p_max_pu_full = (
                network.generators_t.p_max_pu
                .reindex(index=snapshots, columns=network.generators.index, fill_value=1.0)
            )
            available_capacity = p_max_pu_full.multiply(p_nom, axis=1).sum(axis=1)

            gap_series = total_demand - available_capacity
            shortage_timestamps = gap_series[gap_series > 0]

            if not shortage_timestamps.empty:
                new_pmax_cols = {}
                for timestamp, capacity_gap in shortage_timestamps.items():
                    gen_name = f"emergency_gen_{timestamp.strftime('%Y%m%d')}"

                    if gen_name not in network.generators.index:
                        network.add(
                            "Generator",
                            gen_name,
                            bus=reference_bus,
                            p_nom=capacity_gap * 1.1,
                            marginal_cost=800,
                            carrier="import"
                        )

                    if gen_name not in network.generators_t.p_max_pu.columns and gen_name not in new_pmax_cols:
                        new_pmax_cols[gen_name] = pd.Series(0.0, index=snapshots)

                    if gen_name in new_pmax_cols:
                        new_pmax_cols[gen_name].at[timestamp] = 1.0
                    else:
                        network.generators_t.p_max_pu.at[timestamp, gen_name] = 1.0

                if new_pmax_cols:
                    add_df = pd.DataFrame(new_pmax_cols, index=snapshots)
                    network.generators_t.p_max_pu = pd.concat([network.generators_t.p_max_pu, add_df], axis=1)

            network.generators_t.p_max_pu = network.generators_t.p_max_pu.copy()

        network.generators.p_nom_extendable = True
        network.generators.p_nom_max = network.generators.p_nom * 1.5  # 50% de flexibilité 
        
        return network

    @staticmethod
    def align_time_indexes(network):
        """
        Aligne tous les index temporels du réseau avec les snapshots.
        
        Cette méthode:
        1. Identifie tous les DataFrames temporels dans le réseau
        2. Réindexe tous ces DataFrames pour qu'ils correspondent aux snapshots
        3. Remplit les valeurs manquantes par des valeurs appropriées
        
        Args:
            network: Réseau PyPSA à traiter
        """
        logger.info("Alignement des index temporels avec les snapshots du réseau...")
        
        if not hasattr(network, 'snapshots') or len(network.snapshots) == 0:
            logger.warning("Pas de snapshots définis dans le réseau")
            return
        
        # Aligner les index temporels des générateurs
        if hasattr(network, 'generators_t'):
            for attr_name, df in network.generators_t.items():
                if isinstance(df, pd.DataFrame) and not df.empty:
                    if not df.index.equals(network.snapshots):
                        logger.info(f"Réindexation de network.generators_t.{attr_name}")
                        
                        aligned_df = pd.DataFrame(index=network.snapshots, columns=df.columns)
                        
                        for col in df.columns:
                            # Pour les indices communs, prenons les valeurs existantes
                            common_idx = df.index.intersection(network.snapshots)
                            aligned_df.loc[common_idx, col] = df.loc[common_idx, col]
                            
                            # Pour les indices manquants, utiliser une stratégie de remplissage
                            missing_idx = network.snapshots.difference(df.index)
                            if not missing_idx.empty:
                                if not df.empty:
                                    last_val = df.loc[df.index[-1], col]
                                    aligned_df.loc[missing_idx, col] = last_val
                                else:
                                    default_val = 0.0
                                    if attr_name == 'p_max_pu':
                                        default_val = 0.9
                                    elif attr_name == 'marginal_cost':
                                        default_val = 10.0
                                    
                                    aligned_df.loc[missing_idx, col] = default_val

                        network.generators_t[attr_name] = aligned_df
        
        # Aligner les index temporels des charges
        if hasattr(network, 'loads_t'):
            for attr_name, df in network.loads_t.items():
                if isinstance(df, pd.DataFrame) and not df.empty:
                    if not df.index.equals(network.snapshots):
                        logger.info(f"Réindexation de network.loads_t.{attr_name}")
                        
                        aligned_df = pd.DataFrame(index=network.snapshots, columns=df.columns)

                        for col in df.columns:
                            common_idx = df.index.intersection(network.snapshots)
                            aligned_df.loc[common_idx, col] = df.loc[common_idx, col]

                            missing_idx = network.snapshots.difference(df.index)
                            if not missing_idx.empty:
                                if not df.empty:
                                    mean_val = df[col].mean()
                                    std_val = df[col].std() if len(df) > 1 else mean_val * 0.1
                                    
                                    for idx in missing_idx:
                                        prev_week = idx - pd.Timedelta(days=7)
                                        if prev_week in df.index:
                                            val = df.loc[prev_week, col]
                                        else:
                                            noise = np.random.normal(0, std_val * 0.1)
                                            val = max(0, mean_val + noise)
                                        
                                        aligned_df.loc[idx, col] = val
                                else:
                                    aligned_df.loc[missing_idx, col] = 0.0
                        
                        network.loads_t[attr_name] = aligned_df
        
        logger.info("Alignement des index temporels terminé")

    @staticmethod
    def calculate_energy_from_power(network, power_data, is_journalier=None):
        """
        Calcule correctement l'énergie à partir des valeurs de puissance en tenant compte 
        de la durée des snapshots.
        
        Args:
            network: Réseau PyPSA contenant les snapshots
            power_data: DataFrame ou Series contenant des valeurs de puissance en MW
            is_journalier: Si True, force le mode journalier (override de la détection auto)
            
        Returns:
            Même structure que power_data, mais avec des valeurs en MWh
        """
        # Déterminer si nous sommes en mode journalier
        daily_snapshots = False
        
        if is_journalier is not None:
            daily_snapshots = is_journalier
        elif len(network.snapshots) > 1:
            time_diff = network.snapshots[1] - network.snapshots[0]
            if time_diff >= pd.Timedelta(hours=23):
                daily_snapshots = True
        
        # Vérifier si les données sont déjà en énergie
        data_is_energy = getattr(power_data, '_energy_not_power', False)
        
        if isinstance(power_data, pd.DataFrame):
            energy_data = power_data.copy()
            
            if daily_snapshots and not data_is_energy:
                logger.info(f"Mode journalier: Conversion puissance (MW) → énergie (MWh/jour)")
                energy_data = energy_data * 24
            
        elif isinstance(power_data, pd.Series):
            energy_data = power_data.copy()
            
            if daily_snapshots and not data_is_energy:
                energy_data = energy_data * 24
        
        else:
            energy_data = power_data
            if daily_snapshots and not data_is_energy:
                energy_data = energy_data * 24
        
        return energy_data
