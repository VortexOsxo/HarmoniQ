from importlib import import_module

__all__ = [
    "compute_weibull_expected_power",
    "drop_feb29_from_index",
    "estimate_weibull_coefficients",
    "extract_annual_coefficients_from_details",
    "extract_seasonal_coefficients_from_details",
    "month_to_season",
    "mean_operational_loss_factor",
    "parse_weibull_fit_details",
]


def __getattr__(name):
    if name in __all__:
        module = import_module(".Weibull_calcule", __name__)
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

