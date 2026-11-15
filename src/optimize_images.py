"""Shrink the large rate-map PNGs in data/processed without visibly changing them.
Every colour in these maps lies on the rate colour ramp (export_web.ramp: 7 stops from -6 to +2 cm/yr). So instead of a generic palette,
we use 255 colours sampled evenly along that same ramp (one step = 8/254 = 0.03 cm/yr, far finer than the map's own uncertainty) plus
'transparent', and map every pixel to its nearest palette colour. The file is replaced only if the colour error stays tiny.
Run after the export scripts.   Usage: python optimize_images.py [--max-error 4]"""
import argparse, os, glob, numpy as np
from PIL import Image
import export_web
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument("--max-error", type=float, default=4.0); ap.add_argument("--min-kb", type=float, default=500)
a = ap.parse_args()
pal = export_web.ramp(np.linspace(-6, 2, 255)[None, :]).reshape(-1, 4).astype(int)
pal = np.vstack([pal, [0, 0, 0, 0]])                      # last entry: fully transparent (no data)
for p in sorted(glob.glob(f"{ROOT}/data/processed/rate_sentinel1_*.png")):
    kb = os.path.getsize(p) / 1024
    im = np.asarray(Image.open(p).convert("RGBA")).astype(int)
    h, w, _ = im.shape
    cols, inv = np.unique(im.reshape(-1, 4), axis=0, return_inverse=True)
    d = ((cols[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
    d[cols[:, 3] == 0, :] = np.where(np.arange(len(pal)) == len(pal) - 1, 0, 10**9)   # transparent stays transparent
    near = d.argmin(1)
    idx = near[inv.ravel()].reshape(h, w).astype(np.uint8)
    back = pal[idx]
    vis = im[..., 3] > 0
    err = np.abs(back - im)
    p95, mx = float(np.percentile(err[vis][:, :3], 95)), int(err[vis].max())
    out = Image.fromarray(idx, "P")
    out.putpalette(pal.astype(np.uint8).flatten().tolist(), rawmode="RGBA")
    tmp = p + ".tmp.png"
    out.save(tmp, optimize=True)
    check = np.asarray(Image.open(tmp).convert("RGBA")).astype(int)
    same = bool((check == back).all())
    new_kb = os.path.getsize(tmp) / 1024
    ok = same and mx <= a.max_error and new_kb < kb
    print(f"{os.path.basename(p)}: {len(cols)} colours, {kb:.0f} KB -> {new_kb:.0f} KB | colour error p95 {p95:.1f}, max {mx} of 255 | readback exact: {same} | {'REPLACED' if ok else 'left unchanged'}")
    if ok:
        os.replace(tmp, p)
    else:
        os.remove(tmp)
