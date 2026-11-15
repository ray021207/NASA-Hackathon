"""NISAR GUNW troposphere and solid-earth-tide screens, evaluated on the 80 m pixel grid.
The file stores each screen as a 3-D cube (20 heights, 500 m grid) in radians. A pixel needs its own ground height to pick the right slice,
and the file has no per-pixel DEM, so heights come from the open Copernicus 30 m DEM (orthometric; converted to ellipsoidal with a fixed -28 m
geoid offset for Arizona. Checked against the EGM2008 grid with pyproj: -27.8 m at Willcox, -30.5 m at Eloy; the 2.5 m difference is 0.5% of the 500 m layer spacing, so it does not matter. Copernicus GLO-30 is a surface model (includes vegetation), referenced to EGM2008)."""
import os, numpy as np, h5py, rasterio
from rasterio.windows import from_bounds
from scipy.ndimage import map_coordinates
from pyproj import Transformer
from gunw import _h5
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RG = "science/LSAR/GUNW/metadata/radarGrid/"
GEOID_OFFSET_M = -28.0
SCREENS = {"hydro": "hydrostaticTroposphericPhaseScreen", "wet": "wetTroposphericPhaseScreen", "tide": "slantRangeSolidEarthTidesPhase"}


def _tile_url(lat0, lon0):
    ns = f"N{lat0:02d}"
    ew = f"W{-lon0:03d}" if lon0 < 0 else f"E{lon0:03d}"
    n = f"Copernicus_DSM_COG_10_{ns}_00_{ew}_00_DEM"
    return f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif"


def dem_for_box(lonlat_box, name):
    """(array, west, north, step_deg) of the DEM for the box, cached in data/processed/cache."""
    cache = f"{ROOT}/data/processed/cache/dem_{name}.npz"
    if os.path.exists(cache):
        z = np.load(cache)
        return z["a"], float(z["w"]), float(z["n"]), float(z["step"])
    w, s, e, n = lonlat_box
    w -= .05; s -= .05; e += .05; n += .05
    step = 1 / 3600
    nx, ny = int(round((e - w) / step)), int(round((n - s) / step))
    out = np.full((ny, nx), np.nan, "float32")
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        for lat0 in range(int(np.floor(s)), int(np.floor(n)) + 1):
            for lon0 in range(int(np.floor(w)), int(np.floor(e)) + 1):
                try:
                    d = rasterio.open(_tile_url(lat0, lon0))
                except Exception:
                    continue
                with d:
                    b = d.bounds
                    l, bt, r, t = max(w, b.left), max(s, b.bottom), min(e, b.right), min(n, b.top)
                    if l >= r or bt >= t:
                        continue
                    a = d.read(1, window=from_bounds(l, bt, r, t, d.transform)).astype("float32")
                    r0 = int(round((n - t) / step)); c0 = int(round((l - w) / step))
                    hh, ww = min(a.shape[0], ny - r0), min(a.shape[1], nx - c0)
                    out[r0:r0 + hh, c0:c0 + ww] = a[:hh, :ww]
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    np.savez(cache, a=out, w=w, n=n, step=step)
    return out, w, n, step


def heights_on_grid(dem, epsg, x, y):
    a, w, n, step = dem
    X, Y = np.meshgrid(x, y)
    lon, lat = Transformer.from_crs(epsg, 4326, always_xy=True).transform(X, Y)
    h = map_coordinates(np.nan_to_num(a, nan=float(np.nanmedian(a))), [(n - lat) / step - .5, (lon - w) / step - .5], order=1, mode="nearest")
    return h + GEOID_OFFSET_M


def screen_on_grid(path, which, x, y, h):
    """Phase screen (radians) for 'hydro' | 'wet' | 'tide' at pixel coordinates x (1-D), y (1-D) and heights h (2-D, ellipsoidal metres)."""
    with _h5(path) as f:
        g = f[RG]
        xc, yc, hz = g["xCoordinates"][:], g["yCoordinates"][:], g["heightAboveEllipsoid"][:]
        dx, dy = xc[1] - xc[0], yc[1] - yc[0]
        c0 = max(int((x.min() - xc[0]) / dx) - 2, 0); c1 = min(int((x.max() - xc[0]) / dx) + 3, len(xc))
        r0 = max(int((y.max() - yc[0]) / dy) - 2, 0); r1 = min(int((y.min() - yc[0]) / dy) + 3, len(yc))
        cube = g[SCREENS[which]][:, r0:r1, c0:c1].astype("float64")
    X, Y = np.meshgrid(x, y)
    col = (X - xc[0]) / dx - c0
    row = (Y - yc[0]) / dy - r0
    z = np.clip((h - hz[0]) / (hz[1] - hz[0]), 0, len(hz) - 1)
    return map_coordinates(cube, [z, row, col], order=1, mode="nearest")
