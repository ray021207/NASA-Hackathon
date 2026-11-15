"""Turn a desert-sunset photograph into the soft silhouette used behind the opening text on the phone Overview page.

The photograph itself is NOT stored in the repository; only the traced result (web/assets/desert-backdrop.webp).
Steps: crop a portrait slice; find the sky (bright pixels connected to the top edge); everything else is land and
becomes a silhouette tinted from the photo's own warm colours; the sky becomes a pale wash of the photo's colours.
The page applies the final strength with CSS (opacity and a fade mask) so that text on top keeps a contrast of at least 4.5:1.

Usage: python src/make_backdrop.py <photo.png> [out.webp]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "web/assets/desert-backdrop.webp"
W_OUT = 720                      # output width in pixels; height follows the 4:5 crop

im = Image.open(src).convert("RGB")
w, h = im.size
crop_w = int(h * 0.80)           # portrait 4:5 slice, right-hand side (sun, tall saguaros, barrel cactus)
x0 = int(w * 0.54)
im = im.crop((x0, 0, min(w, x0 + crop_w), h))
im = im.resize((W_OUT, int(W_OUT * im.height / im.width)), Image.LANCZOS)
a = np.asarray(im).astype("float32")
lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

# sky = bright (or strongly blue) pixels connected to the top edge
cand = (lum > 118) | ((a[..., 2] > a[..., 0] + 25) & (lum > 80))
cand = ndimage.binary_opening(cand, iterations=1)
lab, n = ndimage.label(cand)
top = set(np.unique(lab[0, :])) - {0}
sky = np.isin(lab, list(top))
sky = ndimage.binary_closing(sky, iterations=2)
sky = ndimage.binary_fill_holes(sky) & ~ndimage.binary_opening(~sky, iterations=0)
land = ~sky
print("land share: %.1f%%" % (100 * land.mean()))

# soft edges
land_f = np.asarray(Image.fromarray((land * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))).astype("float32") / 255

# colours: land keeps the photo's warm/cool tint but is flattened toward a deep plum-brown; sky is the photo washed pale
plum = np.array([62, 40, 50], "float32")
tone = np.clip(lum / 150.0, 0, 1)[..., None]
land_rgb = plum * (1 - 0.55 * tone) + a * (0.55 * tone) * 0.9
sky_rgb = a * 0.55 + 255 * 0.45

rgb = land_f[..., None] * land_rgb + (1 - land_f[..., None]) * sky_rgb
alpha = land_f * 1.0 + (1 - land_f) * 0.55          # sky is lighter and see-through; land is solid
rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype("uint8")
Image.fromarray(rgba, "RGBA").save(out, "WEBP", quality=70, method=6)
import os
print("saved", out, im.size, "%.0f KB" % (os.path.getsize(out) / 1024))
