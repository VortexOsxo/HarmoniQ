from pathlib import Path
import xarray as xr

nc_path = Path("data/meteo/era5/raw/year=2024/month=01/era5_qc_2024_01.nc")
ds = xr.open_dataset(nc_path)

print(ds)
print(ds.data_vars)   # pour voir les noms exacts
print(ds["t2m"])      # température ERA5
