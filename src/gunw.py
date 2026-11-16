"""Read one NISAR GUNW pair, subtract the ionosphere screen, and return LOS displacement (mm) over a lon/lat window.
Sign convention d = -(lambda/4pi)*phi is the standard InSAR convention; the wavelength and sign are read from the product file (see the README, Method)."""
import h5py, numpy as np
from pyproj import Transformer
import contextlib


@contextlib.contextmanager
def _h5(path):
    """Open `path`, or reuse an already-open h5py.File (e.g. one backed by HTTP range requests, see gcov_remote.py)."""
    if isinstance(path, h5py.File):
        yield path
    else:
        with h5py.File(path, "r") as f:
            yield f

GRID = "science/LSAR/GUNW/grids/frequencyA/"
C = 299792458.0

def read_window(path, lonlat_box, subtract_iono=True, coh_min=0.4, dem=None):
    """lonlat_box = (west, south, east, north). Returns dict with arrays on the 80 m UTM grid cropped to the box."""
    with _h5(path) as f:
        g = f[GRID + "unwrappedInterferogram/HH"]
        epsg = int(g["projection"][()])
        x, y = g["xCoordinates"][:], g["yCoordinates"][:]
        t = Transformer.from_crs(4326, epsg, always_xy=True)
        w, s, e, n = lonlat_box
        xs = [t.transform(a, b)[0] for a in (w, e) for b in (s, n)]; ys = [t.transform(a, b)[1] for a in (w, e) for b in (s, n)]
        xi = np.where((x >= min(xs)) & (x <= max(xs)))[0]; yi = np.where((y >= min(ys)) & (y <= max(ys)))[0]
        if len(xi) == 0 or len(yi) == 0:
            return None
        sl = (slice(yi[0], yi[-1] + 1), slice(xi[0], xi[-1] + 1))
        ph = g["unwrappedPhase"][sl]; coh = g["coherenceMagnitude"][sl]; cc = g["connectedComponents"][sl]
        ion = g["ionospherePhaseScreen"][sl]; ionu = g["ionospherePhaseScreenUncertainty"][sl]
        lam = C / f[GRID + "centerFrequency"][()]
        tb = int(f["science/LSAR/GUNW/metadata/orbit/temporalBaseline"][()])
        ident = f["science/LSAR/identification"]
        ref = ident["referenceZeroDopplerStartTime"][()].decode()[:10]; sec = ident["secondaryZeroDopplerStartTime"][()].decode()[:10]
        track = int(ident["trackNumber"][()]); direction = ident["orbitPassDirection"][()].decode()
    valid = np.isfinite(ph) & (cc > 0) & (cc != 65535) & (ph != 0) & np.isfinite(coh) & (coh >= coh_min)
    if subtract_iono:
        valid &= np.isfinite(ion)
        ph = ph - ion
    if dem is not None:   # NISAR hydrostatic + wet troposphere screens; sign verified by the scatter test in nisar_noise_test.py: subtract
        import corrections as corr
        h = corr.heights_on_grid(dem, epsg, x[xi], y[yi])
        for n in ("hydro", "wet"):
            ph = ph - corr.screen_on_grid(path, n, x[xi], y[yi], h)
    disp_mm = -(lam / (4 * np.pi)) * ph * 1000.0
    return dict(x=x[xi], y=y[yi], disp_mm=np.where(valid, disp_mm, np.nan), coh=coh, valid=valid, ion_unc=ionu,
                epsg=epsg, lam=lam, temporal_days=tb, ref_date=ref, sec_date=sec, track=track, direction=direction)

def ref_median(win, lonlat_center, radius_km=5.0):
    """Median displacement in a circle around a chosen stable point (the reference)."""
    t = Transformer.from_crs(4326, win["epsg"], always_xy=True)
    cx, cy = t.transform(*lonlat_center)
    X, Y = np.meshgrid(win["x"], win["y"])
    m = (np.hypot(X - cx, Y - cy) <= radius_km * 1000) & win["valid"]
    return (np.nanmedian(win["disp_mm"][m]), int(m.sum())) if m.any() else (np.nan, 0)
