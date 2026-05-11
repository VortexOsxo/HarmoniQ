from importlib import import_module

__all__ = [
    "DEFAULT_STAGE_A_BBOX_NWSE",
    "DEFAULT_STAGE_A_MESH_KM",
    "DEFAULT_STAGE_A_PROJECTED_CRS",
    "DEFAULT_STAGE_A_TOP_N",
    "build_turbine_power_curve",
    "build_economic_assumptions",
    "compute_weibull_expected_power",
    "DEFAULT_ECONOMIC_SCENARIO",
    "DEFAULT_END_YEAR",
    "DEFAULT_HOURS_PER_YEAR",
    "DEFAULT_MIN_SAMPLES",
    "DEFAULT_PARK_MW",
    "DEFAULT_PRICE_PER_MW",
    "DEFAULT_PROJECT_LIFE_YEARS",
    "DEFAULT_START_YEAR",
    "discrete_annual_energy_kwh",
    "drop_feb29_from_index",
    "EconomicAssumptions",
    "estimate_weibull_coefficients",
    "export_turbine_selection_outputs",
    "export_site_screening_stage_a_outputs",
    "extract_annual_coefficients_from_details",
    "extract_seasonal_coefficients_from_details",
    "generate_metric_mesh_points",
    "infer_rated_power_kw",
    "load_era5_wind_samples_ms",
    "load_era5_available_cells",
    "month_to_season",
    "map_points_to_era5_floor_cells",
    "mean_operational_loss_factor",
    "parse_weibull_fit_details",
    "plot_top10_sites_stage_a",
    "run_site_screening_stage_a",
    "select_representative_points_per_cell",
    "select_best_turbine_for_point",
    "select_best_turbine_from_wind_samples",
    "SiteScreeningStageAConfig",
    "WIND_REFERENCE_HEIGHT_M",
    "weibull_speed_probabilities_by_integer_speed",
]


def __getattr__(name):
    if name not in __all__:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    selection_names = {
        "DEFAULT_END_YEAR",
        "DEFAULT_ECONOMIC_SCENARIO",
        "DEFAULT_HOURS_PER_YEAR",
        "DEFAULT_MIN_SAMPLES",
        "DEFAULT_PARK_MW",
        "DEFAULT_PRICE_PER_MW",
        "DEFAULT_PROJECT_LIFE_YEARS",
        "DEFAULT_START_YEAR",
        "build_economic_assumptions",
        "discrete_annual_energy_kwh",
        "EconomicAssumptions",
        "export_turbine_selection_outputs",
        "infer_rated_power_kw",
        "load_era5_wind_samples_ms",
        "select_best_turbine_for_point",
        "select_best_turbine_from_wind_samples",
        "WIND_REFERENCE_HEIGHT_M",
        "weibull_speed_probabilities_by_integer_speed",
    }
    stage_a_names = {
        "DEFAULT_STAGE_A_BBOX_NWSE",
        "DEFAULT_STAGE_A_MESH_KM",
        "DEFAULT_STAGE_A_PROJECTED_CRS",
        "DEFAULT_STAGE_A_TOP_N",
        "SiteScreeningStageAConfig",
        "export_site_screening_stage_a_outputs",
        "generate_metric_mesh_points",
        "load_era5_available_cells",
        "map_points_to_era5_floor_cells",
        "plot_top10_sites_stage_a",
        "run_site_screening_stage_a",
        "select_representative_points_per_cell",
    }
    if name in selection_names:
        module_name = ".turbine_selection"
    elif name in stage_a_names:
        module_name = ".site_screening_stage_a"
    else:
        module_name = ".Weibull_calcule"
    module = import_module(module_name, __name__)
    return getattr(module, name)

