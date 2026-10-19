# Images

| File | Used for |
|---|---|
| `og-image.jpg` | Link preview on iMessage, Instagram, Facebook and similar apps (1200 × 630). A typographic card with the wordmark and tagline; swap in a hero photo later if you like, keeping the size exactly 1200 × 630. |

## Adding Adam's work

1. Make a folder `images/work/` and put 4–6 of Adam's own photos in it.
2. Add each one to the `gallery` list in `content/site.mjs` (see the example there), then run `node scripts/build.mjs`. The "Selected work" section and its menu link appear automatically.

Tips:
- **Portrait photos** (3:4 or 4:5) work best; the grid crops every tile to 4:5 from the center, so keep the hair in the middle of the frame.
- **About 900 × 1200 pixels, under ~250 KB each.** Phone photos are often 3–6 MB; run them through [squoosh.app](https://squoosh.app) (JPEG or WebP, quality 75).
- **No filters that change the color.** The color is the work.
- **Alt text** describes the hair, e.g. "Shoulder-length copper shag with curtain bangs, seen from the side". **Caption** (optional) is a short label shown under the photo.

A portrait of Adam goes in the same way, through `about.portrait` in `content/site.mjs`.
