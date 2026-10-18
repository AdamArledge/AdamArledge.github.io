# Salon Website

A single-page static site for a cosmetology business. Retro-futurist styling: Y2K chrome meets rock-and-punk salon. Plain HTML, CSS, and a small vanilla JS file. No build step, no framework, no backend. Booking is handled by Vagaro.

```
index.html          the whole page
css/styles.css      all styles; design tokens at the top (:root)
js/main.js          mobile menu, scroll fade-in, gallery lightbox
js/hair.js          animated ASCII hair figure in the hero
images/             gallery photos + social preview image (see images/README.md)
assets/svg/         chrome shapes, sparkles, line illustrations, textures
```

## Fill in your details

Already filled in: business name (AAHairArtistry), stylist (Adam Arledge), studio (Ideation Spa, 1042 Broad Street, Camden, SC 29020), Instagram (@adamarledge), and the site URL (adamarledge.github.io). Search `index.html` for the remaining placeholders:

| Placeholder | Replace with |
|---|---|
| `[PHONE]` | Phone as displayed, e.g. `(555) 123-4567` |
| `[PHONEDIGITS]` | Digits only, e.g. `5551234567` (for tap-to-call) |
| `[EMAIL]` | Email address |
| `[TIKTOK]` | TikTok handle without the `@` (or delete the TikTok links) |
| Bracketed About paragraphs | Adam's bio |
| `$[XX]` | Service prices (edit service names/descriptions too) |
| `VAGARO_BOOKING_URL` | Your Vagaro booking link (appears on every Book button) |
| `[Describe photo N]` | Alt text for each gallery photo |

Also update:
- **Hours.** Edit them in two places: the Contact section *and* `openingHoursSpecification` in the JSON-LD block in `<head>`. Google reads the JSON-LD for search results.
- **Tagline.** The hero uses the suggested line "Sharp cuts, loud color, zero boring." Change it in the hero and in the JSON-LD `description`.

### Vagaro embed instead of a button

The Booking section uses a styled button by default. To embed Vagaro's widget instead, paste your Vagaro embed code inside `<div class="booking__embed">` (replacing the `VAGARO_EMBED_HTML` comment) and delete the button above it. The container shows only when it has content.

## Deploy to GitHub Pages

1. **Create a GitHub repository.** Name it `<username>.github.io` for a root site (`https://<username>.github.io/`), or use any name for a project site (`https://<username>.github.io/<repo>/`).
2. **Upload or push the files.** Either drag the files into the repo on github.com ("Add file → Upload files"), or:
   ```bash
   git init && git add . && git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
3. **Turn on Pages.** In the repository go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.
4. **Wait a minute,** then visit the published URL shown at the top of the Pages settings.
5. **Custom domain (optional).** Enter your domain in Settings → Pages → Custom domain, then add the DNS records from GitHub's guide: [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). Tick **Enforce HTTPS** once it's available. If you use a custom domain, update the `adamarledge.github.io` URLs in `<head>` to match.

All paths are relative, so the site works as either a root or a project site without changes.

## Preview locally

Opening `index.html` directly works. For a closer match to GitHub Pages, run a tiny server from this folder:
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Design notes

**Fonts** (Google Fonts): Unbounded (headlines), DM Serif Display Italic (taglines, service names), DM Sans (body), Space Mono (prices, hours). To swap one, change the `<link>` in `<head>` and the matching `--font-*` variable in `css/styles.css`.

**Contrast rules followed (WCAG AA, 4.5:1 for body text):**

| Pair | Ratio | Use |
|---|---|---|
| Off-white on near-black | 14.3 | ✅ main dark text |
| Near-black on off-white | 14.3 | ✅ main light text |
| Stone on charcoal | 8.3 | ✅ secondary text on dark |
| Sage on near-black | 5.4 | ✅ prices |
| Near-black on sage | 5.4 | ✅ if you put text on sage |
| White on electric blue | 5.1 | ✅ button labels |
| Off-white on sage | 2.6 | ❌ avoid |
| Off-white on taupe | 2.4 | ❌ avoid |
| Electric blue as text (dark or light bg) | 3.6–3.9 | ❌ blue is used only as a fill, underline, or decoration |

**Motion:** Fade-in on scroll, chrome sparkle twinkle, and hover lifts. All of it is disabled when the visitor's device has "reduce motion" turned on.

**Hero ASCII hair (`js/hair.js`):** a bowed, featureless head in profile whose hair drifts as text characters on a `<canvas>`. Each strand is a chain of fixed-length segments bent sideways by a *curl-noise* flow field (a swirling, fluid-like motion) and pulled back toward its outward direction by a spring. Each segment's angle eases toward that target, so the motion stays smooth and strands never stretch. Characters follow each strand's direction (`- | / \`), with denser ones (`* # % @`) where strands overlap. It sits beside the title on wide screens and above it on phones and portrait tablets. It pauses when off-screen or in a background tab, runs at 20fps on phones, and shows a still frame with "reduce motion" on. To tune the look, edit the constants at the top of the file: `BEND` (curliness), `SPRING` (how radial), `MAX_TURN` (tightest curl), `EASE` (silkiness), and `PALETTES` (colors).
