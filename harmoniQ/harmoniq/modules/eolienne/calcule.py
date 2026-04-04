import numpy as np
import pandas as pd
from typing import Optional

from harmoniq.db.schemas import EolienneParc, weather_schema
from harmoniq.modules.eolienne.turbine_data import turbine_models


def adjust_wind_speed(v_meteo, z_meteo, z_eolien, z0=0.03):
    """
    Adjust the wind speed measured at z_ref (m) to the hub height z_hub (m)
    using the logarithmic wind profile law.
    """
    # TODO: @Zineb: PQ on utilise z0 = 0.03 ?
    return v_meteo * (np.log(z_eolien / z0) / np.log(z_meteo / z0))


def air_density(temperature, pressure):
    """
    Calculate the air density (kg/m³) using the ideal gas law.
    temperature in K, pressure in Pa.
    """
    R = 287.05  # J/(kg·K)
    return pressure / (R * temperature)


def piecewise_power_curve(
    v, cut_in_speed, rated_speed, cut_out_speed, rated_power, power_shape_exponent=3.0
):
    """
    Piecewise model of a generic power curve:
      - P=0 if v < cut_in or v > cut_out
      - P rises from 0 to P_nominal between cut_in and rated (law ~ (v - cut_in)^exponent)
      - P = P_nominal between rated and cut_out
    v : wind speed (array or float)
    cut_in_speed, rated_speed, cut_out_speed : key speeds (m/s)
    rated_power : nominal power (kW)
    power_shape_exponent : exponent for the rise (3.0 by default)
    Returns an array/float P(v) (W).
    """
    power = np.zeros_like(v, dtype=float)

    # Masks
    mask_cut_in = (v >= cut_in_speed) & (v < rated_speed)
    mask_rated = (v >= rated_speed) & (v <= cut_out_speed)
    # Values outside [cut_in, cut_out] remain at 0

    # Zone 2: power rise
    v_in_zone = v[mask_cut_in]
    power[mask_cut_in] = (
        rated_power
        * ((v_in_zone - cut_in_speed) / (rated_speed - cut_in_speed))
        ** power_shape_exponent
    )

    # Zone 3: nominal power
    power[mask_rated] = rated_power

    return power


def infer_rated_speed(
    turbine_data: dict,
    cut_in_speed: float,
    cut_out_speed: float,
) -> float:
    """
    Infer a robust rated speed (m/s) for piecewise fallback mode.

    Priority:
    1) explicit ``rated_wind_speed`` from turbine metadata
    2) conservative default value (12 m/s) clipped inside (cut_in, cut_out)
    """
    explicit = turbine_data.get("rated_wind_speed")
    if explicit is not None:
        rated = float(explicit)
        if cut_in_speed < rated < cut_out_speed:
            return rated

    default_rated_speed = 12.0
    return float(np.clip(default_rated_speed, cut_in_speed + 0.5, cut_out_speed - 0.5))


def power_from_real_curve(
    v_ms: np.ndarray,
    turbine_data: dict,
    cut_in_speed: float,
    cut_out_speed: float,
) -> Optional[np.ndarray]:
    """
    Compute turbine power from manufacturer power curve if available.

    Returns power in kW, or None when no valid power curve is available.
    """
    curve = turbine_data.get("power_curve")
    if not isinstance(curve, pd.DataFrame):
        return None
    if not {"wind_speed", "power"}.issubset(curve.columns):
        return None

    curve = curve.dropna(subset=["wind_speed", "power"]).copy()
    if curve.empty:
        return None
    curve = curve.sort_values("wind_speed")

    ws = curve["wind_speed"].astype(float).to_numpy()
    pw = curve["power"].astype(float).to_numpy() / 1000.0  # source curve is in W
    power_kw = np.interp(v_ms, ws, pw, left=0.0, right=0.0)
    power_kw[(v_ms < cut_in_speed) | (v_ms > cut_out_speed)] = 0.0
    return power_kw


def apply_directional_losses(direction_series):
    """
    Calculate a directional loss factor vectorized.
    Hypothesis: optimal direction = 180°, max 30% losses if deviation = 180°.
    Bounded at 0.7 minimum (70%).
    """
    # TODO: @Zineb: PQ on utilise optimal_direction = 180, on ne connais pas la direction des éoliennes ?
    optimal_direction = 180
    max_loss = 0.3
    deviation = np.abs(direction_series - optimal_direction)
    deviation = np.where(deviation > 180, 360 - deviation, deviation)
    loss = 1 - (max_loss * (deviation / 180.0))
    loss = np.maximum(loss, 0.7)
    return loss


def apply_wake_losses(direction_series):
    """
    Simplified wake loss factor: 10% losses if |dir - 180| < 30°, otherwise 0%.
    """
    condition = np.abs(direction_series - 180) < 30
    return np.where(condition, 0.9, 1.0)


def ice_loss_factor(temperature_k: np.ndarray, stochastic: bool = True) -> np.ndarray:
    """
    Compute icing loss factors from temperatures in Kelvin using deterministic tiers.

    Tiers (simple operational rule):
    - T < 263.15 K  (-10 C): strong icing losses, factor = 0.60
    - 263.15 K <= T < 273.15 K (-10 C to 0 C): moderate icing losses, factor = 0.80
    - T >= 273.15 K (>= 0 C): no icing loss, factor = 1.00

    ``stochastic`` is kept for backward compatibility but is intentionally ignored.
    """
    t_k = np.asarray(temperature_k, dtype=float)
    losses = np.ones_like(t_k, dtype=float)
    valid = np.isfinite(t_k)
    if not np.any(valid):
        return losses

    very_cold = valid & (t_k < 263.15)
    cold = valid & (t_k >= 263.15) & (t_k < 273.15)
    losses[very_cold] = 0.60
    losses[cold] = 0.80
    return losses


def get_parc_power(parc: EolienneParc, meteo: pd.DataFrame) -> pd.DataFrame:
    # Get the turbine data
    turbine_data = turbine_models.get(parc.modele_turbine, None)
    if turbine_data is None:
        raise ValueError(f"Unknown turbine model: {parc.modele_turbine}")

    # Set tempature to Kelvin
    meteo["temperature"] = meteo["temperature_C"] + 273.15

    # Adjust wind speed to hub height.
    # The turbine cut-in/cut-out values are in m/s, so convert input wind speed from
    # km/h to m/s before using the power curve.
    vitesse_vent_ms = meteo["vitesse_vent_kmh"].values / 3.6
    # ERA5/Open-Meteo wind input is handled as 100 m reference wind speed.
    # Using 10 m here was over-amplifying hub-height wind and inflating production.
    v_ref_height_m = 100.0
    # Default roughness remains unchanged for existing onshore parks.
    # Optional override is used by the 2035 site-selection backend:
    # - onshore  -> z0 ~= 0.03
    # - offshore -> z0 = 0.0
    roughness_z0 = float(getattr(parc, "surface_roughness_z0_m", 0.03))
    hub_height = float(getattr(parc, "hauteur_moyenne"))
    vitesse_vents = adjust_wind_speed(
        vitesse_vent_ms,
        v_ref_height_m,
        hub_height,
        z0=roughness_z0,
    )

    cut_in = float(turbine_data["cut_in_wind_speed"])
    cut_out = float(turbine_data["cut_out_wind_speed"])

    # 1) Prefer real manufacturer power curve when available.
    # 2) Otherwise fallback to piecewise model with improved rated-speed inference.
    power_output_direction = power_from_real_curve(
        v_ms=vitesse_vents,
        turbine_data=turbine_data,
        cut_in_speed=cut_in,
        cut_out_speed=cut_out,
    )
    if power_output_direction is None:
        rated_speed = infer_rated_speed(turbine_data, cut_in_speed=cut_in, cut_out_speed=cut_out)
        power_output_direction = piecewise_power_curve(
            vitesse_vents,
            cut_in,
            rated_speed,
            cut_out,
            parc.puissance_nominal,
        )

    # Apply directional losses
    directional_losses = apply_directional_losses(meteo["direction_vent"])
    power_with_directional_losses = power_output_direction * directional_losses

    # Apply wake losses
    wake_losses = apply_wake_losses(meteo["direction_vent"])
    power_with_wake_losses = power_with_directional_losses * wake_losses

    # Apply ice losses
    ice_losses = ice_loss_factor(meteo["temperature"].to_numpy(dtype=float))
    power_with_ice_losses = power_with_wake_losses * ice_losses

    # Apply for all turbines in the parc
    power_parc = power_with_ice_losses * parc.nombre_eoliennes

    # Calculate the energy produced
    df = pd.DataFrame(
        {
            "tempsdate": meteo.index.values,
            "vitesse_vent_kmh": meteo["vitesse_vent_kmh"].values,
            "direction_vent": meteo["direction_vent"].values,
            "puissance": power_parc,
        }
    )

    return df
