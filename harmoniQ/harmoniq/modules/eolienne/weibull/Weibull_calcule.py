from __future__ import annotations

import json
import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.special import gamma
from scipy.stats import weibull_min

from harmoniq.db.schemas import EolienneParc

SEASON_ORDER = ("winter", "spring", "summer", "autumn")
SEASON_MONTHS = {
    "winter": (12, 1, 2),
    "spring": (3, 4, 5),
    "summer": (6, 7, 8),
    "autumn": (9, 10, 11),
}


def month_to_season(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    raise ValueError(f"Invalid month value: {month}")


def drop_feb29_from_index(df: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(df.index, pd.DatetimeIndex):
        raise TypeError("Expected DatetimeIndex")
    mask = (df.index.month == 2) & (df.index.day == 29)
    if mask.any():
        return df.loc[~mask].copy()
    return df


def parse_weibull_fit_details(raw: object) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        payload = raw.strip()
        if not payload:
            return {}
        try:
            parsed = json.loads(payload)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


def _read_valid_kc(entry: object) -> tuple[float, float] | None:
    if not isinstance(entry, dict):
        return None
    k = entry.get("k")
    c = entry.get("c")
    if k is None or c is None:
        return None
    try:
        kf = float(k)
        cf = float(c)
    except (TypeError, ValueError):
        return None
    if not (np.isfinite(kf) and np.isfinite(cf) and kf > 0 and cf > 0):
        return None
    return kf, cf


def extract_annual_coefficients_from_details(details: dict) -> tuple[float, float] | None:
    annual = details.get("annual") if isinstance(details, dict) else None
    return _read_valid_kc(annual)


def extract_seasonal_coefficients_from_details(details: dict) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    seasonal = details.get("seasonal") if isinstance(details, dict) else None
    if not isinstance(seasonal, dict):
        return out
    for season in SEASON_ORDER:
        kc = _read_valid_kc(seasonal.get(season))
        if kc is not None:
            out[season] = kc
    return out


def _piecewise_power_curve(
    v: np.ndarray,
    cut_in_speed: float,
    rated_speed: float,
    cut_out_speed: float,
    rated_power: float,
    power_shape_exponent: float = 3.0,
) -> np.ndarray:
    power = np.zeros_like(v, dtype=float)
    mask_cut_in = (v >= cut_in_speed) & (v < rated_speed)
    mask_rated = (v >= rated_speed) & (v <= cut_out_speed)
    v_in_zone = v[mask_cut_in]
    power[mask_cut_in] = (
        rated_power
        * ((v_in_zone - cut_in_speed) / (rated_speed - cut_in_speed))
        ** power_shape_exponent
    )
    power[mask_rated] = rated_power
    return power


def _apply_wake_losses(direction_series: np.ndarray) -> np.ndarray:
    condition = np.abs(direction_series - 180) < 30
    return np.where(condition, 0.9, 1.0)


def _ice_loss_factor(temperature_k: np.ndarray, stochastic: bool = True) -> np.ndarray:
    t_k = np.asarray(temperature_k, dtype=float)
    freezing_mask = np.isfinite(t_k) & (t_k < 273.15)
    losses = np.ones_like(t_k, dtype=float)
    if not np.any(freezing_mask):
        return losses
    if stochastic:
        losses[freezing_mask] = np.random.uniform(0.5, 1.0, size=int(freezing_mask.sum()))
    else:
        losses[freezing_mask] = 0.75
    return losses


def mean_operational_loss_factor(meteo: pd.DataFrame) -> float:
    """
    Mean multiplicative loss factor over a meteo series for:
    - wake losses,
    - icing losses (deterministic expected value).
    """
    wake = _apply_wake_losses(meteo["direction_vent"].to_numpy(dtype=float))
    if "temperature" in meteo.columns:
        temperature_k = meteo["temperature"].to_numpy(dtype=float)
    elif "temperature_C" in meteo.columns:
        temperature_k = meteo["temperature_C"].to_numpy(dtype=float) + 273.15
    else:
        raise ValueError("Temperature column not found in meteo DataFrame")

    ice = _ice_loss_factor(temperature_k, stochastic=False)
    combined = wake * ice
    valid = combined[np.isfinite(combined)]
    if valid.size == 0:
        return 1.0
    return float(valid.mean())


def estimate_weibull_coefficients(
    wind_speed_ms: np.ndarray,
    min_samples: int = 500,
    k_bounds: tuple[float, float] = (0.5, 10.0),
) -> tuple[float, float, int, str]:
    """
    Estimate Weibull (k, c) from wind speed samples in m/s.
    Returns (k, c, sample_count, method_used).
    """
    v = np.asarray(wind_speed_ms, dtype=float)
    v = v[np.isfinite(v)]
    v = v[v > 0]
    sample_count = int(v.size)
    if sample_count < min_samples:
        raise ValueError(
            f"Not enough samples to fit Weibull: {sample_count} < {min_samples}"
        )

    try:
        k_mle, _, c_mle = weibull_min.fit(v, floc=0)
        if (
            np.isfinite(k_mle)
            and np.isfinite(c_mle)
            and k_bounds[0] < k_mle < k_bounds[1]
            and c_mle > 0
        ):
            return float(k_mle), float(c_mle), sample_count, "mle"
    except Exception:
        pass

    mean_v = float(np.mean(v))
    std_v = float(np.std(v))
    if not np.isfinite(mean_v) or not np.isfinite(std_v) or mean_v <= 0:
        raise ValueError("Cannot estimate Weibull from invalid moments")

    cv_target = std_v / mean_v

    def cv_model(k: float) -> float:
        return np.sqrt(gamma(1 + 2 / k) / (gamma(1 + 1 / k) ** 2) - 1)

    def objective(k: float) -> float:
        return float(cv_model(k) - cv_target)

    try:
        k_mom = float(brentq(objective, 0.2, 20.0, maxiter=200))
        c_mom = float(mean_v / gamma(1 + 1 / k_mom))
    except Exception as exc:
        raise ValueError("Weibull estimation failed (MLE and moments)") from exc

    if not (k_bounds[0] < k_mom < k_bounds[1] and c_mom > 0):
        raise ValueError(
            f"Weibull moments estimate out of range: k={k_mom:.3f}, c={c_mom:.3f}"
        )
    return k_mom, c_mom, sample_count, "moments"


def _build_turbine_power_curve(
    v_grid: np.ndarray,
    turbine_data: dict,
    rated_power_kw: float,
    prefer_real_power_curve: bool = True,
) -> np.ndarray:
    cut_in = float(turbine_data["cut_in_wind_speed"])
    cut_out = float(turbine_data["cut_out_wind_speed"])

    if (
        prefer_real_power_curve
        and "power_curve" in turbine_data
        and isinstance(turbine_data["power_curve"], pd.DataFrame)
    ):
        curve = turbine_data["power_curve"].dropna(subset=["wind_speed", "power"]).copy()
        curve = curve.sort_values("wind_speed")
        ws = curve["wind_speed"].astype(float).to_numpy()
        pw = curve["power"].astype(float).to_numpy()
        pw_kw = pw / 1000.0
        power = np.interp(v_grid, ws, pw_kw, left=0.0, right=0.0)
        power[(v_grid < cut_in) | (v_grid > cut_out)] = 0.0
        return power

    rated_speed = (cut_in + cut_out) / 2.0
    return _piecewise_power_curve(v_grid, cut_in, rated_speed, cut_out, rated_power_kw)


def build_turbine_power_curve(
    v_grid: np.ndarray,
    turbine_data: dict,
    rated_power_kw: float,
    prefer_real_power_curve: bool = True,
) -> np.ndarray:
    """
    Public wrapper around turbine power-curve construction.

    This keeps curve logic centralized for all Weibull-based workflows.
    """
    return _build_turbine_power_curve(
        v_grid=v_grid,
        turbine_data=turbine_data,
        rated_power_kw=rated_power_kw,
        prefer_real_power_curve=prefer_real_power_curve,
    )


def compute_weibull_expected_power(
    parc: EolienneParc,
    turbine_data: dict,
    weibull_k: float,
    weibull_c: float,
    v_max: float | None = None,
    n_points: int = 2000,
    prefer_real_power_curve: bool = True,
) -> float:
    """
    Compute expected mean power for a park (kW) from a Weibull(k, c) wind model:
      E[P] = integral(P(v) * f_weibull(v; k,c) dv)
    """
    if weibull_k <= 0 or weibull_c <= 0:
        raise ValueError("Invalid Weibull parameters: k and c must be > 0")
    if n_points < 200:
        raise ValueError("n_points too small for stable numerical integration")

    cut_out = float(turbine_data["cut_out_wind_speed"])
    vmax = v_max if v_max is not None else max(50.0, cut_out * 1.5, weibull_c * 8.0)
    v = np.linspace(0.0, float(vmax), int(n_points))
    pdf = weibull_min.pdf(v, weibull_k, loc=0, scale=weibull_c)
    p_turbine_kw = build_turbine_power_curve(
        v,
        turbine_data,
        float(parc.puissance_nominal),
        prefer_real_power_curve=prefer_real_power_curve,
    )

    expected_turbine_kw = float(np.trapz(p_turbine_kw * pdf, v))
    expected_park_kw = expected_turbine_kw * float(parc.nombre_eoliennes)
    return expected_park_kw
