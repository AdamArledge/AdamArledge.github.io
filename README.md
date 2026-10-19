# AAHairArtistry

One-page site for AAHairArtistry: hair by Adam Arledge, inside Ideation Spa, 1042 Broad Street, Camden, SC 29020. Static HTML and CSS with a small vanilla JS file, hosted on GitHub Pages from the `main` branch.

```
content/site.mjs      ALL editable business content (booking, services, links, photos, reviews)
templates/index.html  page layout and fixed copy, with {{ }} slots filled from site.mjs
scripts/build.mjs     writes index.html from the two files above (no dependencies)
index.html            GENERATED: what GitHub Pages serves. Don't edit it by hand.
css/styles.css        all styles; design tokens at the top (:root)
js/main.js            mobile menu and photo viewer
js/wordmark.js        draws the hero wordmark as halftone dots
images/               social preview image; Adam's photos go in images/work/ (see images/README.md)
assets/svg/           favicon
```

## Editing content

1. Edit `content/site.mjs`. Every field is commented. Empty values ("" or []) are left off the page entirely.
2. Rebuild: `node scripts/build.mjs` (Node 18 or newer).
3. Commit both `content/site.mjs` and the regenerated `index.html`.

`node scripts/build.mjs --check` reports whether `index.html` is out of date.

**Why a build step:** the services, booking links, contact details and search-engine data are written into `index.html` itself, so they show without JavaScript and appear immediately for visitors and search engines, while still coming from one editable file. GitHub Pages keeps serving the committed `index.html`; nothing about the deployment changed. **The tradeoff** is that someone has to run the build after editing `content/site.mjs`. If editing happens on github.com, a small GitHub Actions workflow could run the build automatically, but that would change how the site deploys, so it hasn't been added.

What appears automatically once filled in:
- `booking.consultationUrl`: a separate "Book a consultation" button (only with a link that opens the consultation itself)
- `booking.instructions`: a one-line note under the booking buttons, e.g. "On Vagaro, choose Adam Arledge as your professional."
- `services[].items[]`: `price`, `duration`, `note` (requirement or inclusion) and `bookingUrl` (a link that opens that exact service)
- `contact`: phone, email, hours, visit notes
- `firstVisit`: the "Your first visit" steps section
- `gallery`: the Selected work section, its menu link and the photo viewer
- `about`: bio paragraphs and portrait
- `reviews`: the client reviews section and its menu link

## Booking and links

- **Booking:** every "Book an appointment" button opens `https://www.vagaro.com/ideationpros/book-now` in a new tab. This is the salon's general Vagaro booking page; Vagaro lists the business as "Ideation Spa Salon" with several professionals, so visitors probably need to pick Adam in the flow. That step hasn't been checked (Vagaro couldn't be opened from the build environment), so no instruction is shown yet. Once confirmed, add it as `booking.instructions`.
- **More links:** `https://linktr.ee/AAHairArtistry` appears as a secondary link in the Visit section and footer. Booking never routes through it. Its contents couldn't be inspected, so no extra social profiles were added from it.
- **Instagram:** `@adamarledge`, as supplied by the owner.

## Content still needed

| Content | Where it goes |
|---|---|
| Confirm the Vagaro flow: does the visitor choose Adam? Wording for that step | `booking.instructions` |
| Direct Vagaro links for Adam's services or consultation (only real links from Vagaro) | `services[].items[].bookingUrl`, `booking.consultationUrl` |
| Service names as they appear on Adam's Vagaro menu (rename or regroup to match) | `services` |
| Starting prices and approximate durations | `price`, `duration` |
| Consultation rules: which services need one, new-client rules, color corrections | `note` beside each service |
| Whether vivids include lightening; root touch-up vs all-over color; highlights vs balayage as one booking or two | `services` |
| What each service includes (wash, toner, gloss...) | `description` / `note` |
| Whether the consultation is free and how long it is | Consultation `price` / `duration` |
| 4–6 photos of Adam's work with descriptions; optional hero photo | `gallery`, `images/work/` |
| Portrait and short bio (background, specialties, what an appointment is like) | `about` |
| First-visit guidance (arrival, what to bring), if Adam wants it | `firstVisit` |
| Adam's public phone and/or email, if he wants them listed | `contact` |
| Hours or "by appointment" wording for Adam's chair | `contact.hours` |
| Parking, entrance or accessibility details | `contact.visitNotes` |
| Client reviews, with permission and source | `reviews` |
| Social profiles linked from the Linktree (direct URLs) | `social` |

**Studio name, unresolved:** the site says "Ideation Spa" (as the owner gave it). Vagaro lists the business as "Ideation Spa Salon", and the salon's own website and Vagaro handle use "Ideation Professionals" / "ideationpros". All three share the 1042 Broad Street address. Confirm which name visitors should look for, then change `business.studio`.

**Not added on purpose:** the salon's phone number and hours appear on public listings, but they're salon-wide and the listings disagree on hours, so they aren't shown as Adam's. Staff-page text found through search wasn't clearly attributable to Adam, so no bio details were taken from it.

## Design system

**Direction:** editorial punk. Warm cream paper, near-black ink, a burgundy halftone wordmark, one cobalt accent for actions, and bold condensed section headings. The hair photography should carry the visual interest.

**Wordmark:** "AAhairartistry" as a printed halftone: a grid of round burgundy dots that swell and run together inside the letters (leaving small light holes) and shrink to specks at the edges. `js/wordmark.js` draws it into a canvas when the page loads, on one line on wide screens and stacked "AAhair / artistry" on narrow ones, redrawing sharply at any size. On each page load the dots float loose around the wordmark for about two and a half seconds, drifting and slowly drawing in, then gather into the letters from the centre outwards; the whole sequence takes about 4.7 seconds. The pieces are tiles cut from the finished wordmark, so they land pixel for pixel on it. The sequence is kept under 5 seconds on purpose: accessibility guidelines (WCAG 2.2.2) require a pause control for motion that starts on its own and lasts longer. It plays once (not on scroll or resize) and is skipped for visitors who've turned on "reduce motion". The wordmark's box is reserved by CSS from the first paint, so nothing on the page moves. The timing is set by `FLOAT`, `GATHER_STAGGER`, `GATHER_MIN`, `GATHER_MAX`, `DRIFT` and `SCATTER` at the top of `js/wordmark.js`.

The heading's text stays real for screen readers and search engines; without JavaScript the name shows as plain type in the same font (if the script fails to load, the type appears after 3 seconds). The header and footer use the plain type, since the dots need size to read.

The letters are **SF Pro Rounded** (Heavy/Black) on iPhone, iPad and Mac, through the CSS `ui-rounded` font keyword. Apple's license doesn't allow SF Pro Rounded to be embedded on a website, so other devices (Android, Windows) get **Nunito**, a free rounded font, requested from Google Fonts for just the wordmark's letters. The dot size, density and texture are the constants at the top of `js/wordmark.js`; `CELLS_PER_CAP` is the main legibility control (fewer rows = bigger dots, harder to read).

**Fonts** (Google Fonts): the rounded wordmark face above, Anton for section headings, DM Sans for navigation, body and interface text, Instrument Serif Italic as a sparing accent (tagline, Meet Adam intro, review quotes).

**Tokens** live at the top of `css/styles.css`: color, type scale, spacing (8 / 16 / 24 / 32 / 48 / 64 / 96), one image radius (6px), one button radius (4px).

| Pair | Ratio | Use |
|---|---|---|
| Ink `#171715` on cream `#F1EADF` | 15.0 | Body text, headings |
| Burgundy `#4A1C24` on cream | 11.9 | The wordmark |
| Muted `#5C5A54` on cream / stone | 5.8 / 5.1 | Secondary text, fine print |
| White on cobalt `#3755EE` | 5.7 | Primary button labels |
| Cobalt on cream | 4.75 | Links, step numbers |
| Cobalt on stone `#E6DDCE` | 4.2 ❌ | Not used as text; links on stone are ink with a cobalt underline |
| Cream on ink | 15.0 | Visit section text |
| `#9DADFF` on ink | 8.4 | Links and focus rings on the dark section |
| Cobalt against ink | 3.2 | Button edge on dark (meets 3:1 for controls) |

**Components:** primary button (cobalt fill, with a small arrow meaning "opens in a new tab"), secondary button (ink outline), text link with arrow, booking panel, service rows, numbered steps, and the photo viewer (Previous / Next / Close buttons, arrow keys, Escape, focus kept inside and returned to the photo that opened it).

**Motion:** only small hover transitions, all off under "reduce motion".

## Preview locally

```bash
node scripts/build.mjs
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

GitHub Pages publishes the `main` branch (Settings → Pages → Deploy from a branch → `main`, `/ (root)`). Merge into `main` and the site updates within a minute or two. Paths are relative, so the site also works as a project site or on a custom domain; for a custom domain, update `business.siteUrl` in `content/site.mjs` and rebuild.
