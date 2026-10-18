# Images to supply

Replace the placeholder files in this folder with real photos, **keeping the same filenames** (or update the paths in `index.html`).

| File | Used for | Suggested size | Notes |
|---|---|---|---|
| `gallery-1.jpg` | Gallery tile (tall) | 800 × 1200 | Portrait. Great for a full-length cut or long color. |
| `gallery-2.jpg` | Gallery tile | 800 × 800 | Wide on tablet; any crop works. |
| `gallery-3.jpg` | Gallery tile (wide/large) | 1200 × 800 | Your strongest shot. It's the biggest tile on tablet. |
| `gallery-4.jpg` | Gallery tile | 800 × 800 | Square. |
| `gallery-5.jpg` | Gallery tile (tall) | 800 × 1200 | Portrait. |
| `gallery-6.jpg` | Gallery tile (wide) | 1200 × 800 | Landscape. |
| `og-image.jpg` | Link preview on Instagram/iMessage/Facebook | 1200 × 630 | Logo or hero photo. Must stay exactly this ratio. |

Tiles crop with `object-fit: cover`, so the subject should sit near the center.

## Compression

Aim for **under ~250 KB per photo**. Export as JPEG at quality 70–80, or run the photos through [squoosh.app](https://squoosh.app) (free, in-browser). Phone photos straight off the camera are often 3–6 MB, which would make the page slow on mobile data.

After replacing each photo, update its `alt="[Describe photo N]"` text in `index.html` with a short description, e.g. `alt="Copper shag with curtain bangs"`. Screen readers read this aloud, and Google uses it for image search.
