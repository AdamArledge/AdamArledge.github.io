# AAHairArtistry

One-page site for AAHairArtistry: hair by Adam Arledge, inside Ideation Spa, 1042 Broad Street, Camden, SC 29020. Plain HTML, CSS and a small vanilla JS file. No build step, no framework. Hosted on GitHub Pages from the `main` branch.

```
index.html          page structure, hero copy, metadata
js/content.js       ALL editable business content (booking link, contact, services, photos, reviews)
js/main.js          builds the content-driven parts from content.js; mobile menu; photo viewer
css/styles.css      all styles; design tokens at the top (:root)
images/             social preview image; Adam's photos go in images/work/ (see images/README.md)
assets/svg/         favicon
```

## Editing content

Open `js/content.js`. Every field is commented. Fill in a value and it appears on the page; leave it empty and that piece is left off (no blank slots, no placeholder text). This includes:

- **`booking.url`**: the Vagaro link. Until it's set, booking buttons lead to a short "message Adam on Instagram" panel instead of a broken link. Once it's set, every booking button opens Vagaro in a new tab and the copy switches to say so.
- **`booking.consultationUrl`** (optional): a direct Vagaro link to the consultation service.
- **`contact`**: phone, email, hours, visit notes (parking, entrance). Each one shows in the Visit section and is added to Google's business data.
- **`services`**: per service, `price`, `duration`, `note` (booking requirement or what's included) and `bookingUrl` (only if Vagaro has a direct link to that service).
- **`gallery`**: Adam's photos. The Work section and menu link appear once there is at least one.
- **`about`**: bio paragraphs and a portrait.
- **`reviews`**: real client reviews only. The section appears once one is added.

The hero headline, tagline and one-line description are written directly in `index.html` so they load instantly.

## Content still needed

The site shows only confirmed facts. These are missing:

| Content | Where it goes | Shows up in |
|---|---|---|
| Vagaro booking URL | `booking.url` | Every Book button, Services, Visit, first-visit steps |
| Consultation link on Vagaro (optional) | `booking.consultationUrl` | "Book a consultation" buttons |
| Starting prices per service | `services[].items[].price` | Services list |
| Approximate durations | `services[].items[].duration` | Services list |
| Consultation rules: which services require one; new-client rules; color corrections | `services[].items[].note` | Beside each affected service |
| Whether vivids include lightening or it's booked separately | Vivid Color `note` | Services list |
| Whether a root touch-up is a separate service from all-over color | New item in `services` | Services list |
| Whether highlights and balayage are one booking or two | `services` | Services list |
| What each service includes (e.g. wash, toner, gloss) | `description` / `note` | Services list |
| Whether the consultation is free and how long it is | Consultation `price` / `duration` | Services list |
| 4–6 photos of Adam's work, with descriptions | `gallery` + `images/work/` | Selected work section (hidden until added) |
| A strong hero photo (optional) | `index.html` hero, see the comment there | Hero |
| Portrait of Adam | `about.portrait` | Meet Adam |
| Short bio: background, specialties, what an appointment is like | `about.paragraphs` | Meet Adam |
| Phone and/or email (only if Adam wants them public) | `contact` | Visit section, Google data |
| Hours or "by appointment only" wording | `contact.hours` | Visit section, Google data |
| Parking, entrance or accessibility details | `contact.visitNotes` | Visit section |
| Client reviews with permission and source | `reviews` | Reviews section (hidden until added) |
| TikTok or other social accounts, if any | `social` | Footer, Google data |

To check: a public directory lists the business at 1042 Broad Street as **"Ideation Professionals"**, not "Ideation Spa". If the spa has changed its name, update the studio name everywhere it appears in `index.html`.

## Design system

**Direction:** editorial punk. Warm ivory paper, near-black ink, one cobalt accent, bold condensed display type, and one recurring four-point sparkle. The hair photography should carry the visual interest; the layout stays out of its way.

**Fonts** (Google Fonts): Anton for the wordmark and section headings, DM Sans for body and interface text, Instrument Serif Italic as a sparing accent (the tagline, the Meet Adam intro, review quotes).

**Tokens** live at the top of `css/styles.css`: color, type scale, spacing (8 / 16 / 24 / 32 / 48 / 64 / 96), one image radius (6px), one button radius (4px).

**Color roles and contrast (WCAG AA):**

| Pair | Ratio | Use |
|---|---|---|
| Ink `#171715` on ivory `#F2EFE8` | 15.6 | Body text, headings |
| Muted `#5C5A54` on ivory / stone | 6.0 / 5.2 | Secondary text |
| White on cobalt `#3755EE` | 5.7 | Primary button labels |
| Cobalt on ivory | 4.95 | Links, step numbers |
| Cobalt on stone `#E4DFD3` | 4.3 ❌ | Not used as text; links on stone are ink with a cobalt underline |
| Ivory on ink | 15.6 | Visit section text |
| `#9DADFF` on ink | 8.4 | Links and focus rings on the dark section |
| Cobalt against ink | 3.2 | Primary button edge on dark (meets the 3:1 rule for controls) |

**Components:** primary button (cobalt fill), secondary button (ink outline), text link with arrow, the booking panel, service rows, numbered steps, and the photo viewer (keyboard arrows, Escape, visible Previous/Next/Close, focus returns to the photo that opened it).

**Motion:** only small hover transitions. Everything is off when the visitor's device asks for reduced motion.

## Preview locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

GitHub Pages publishes the `main` branch (Settings → Pages → Deploy from a branch → `main`, `/ (root)`). Merge a pull request into `main` and the site updates within a minute or two. All paths are relative, so the site also works as a project site or on a custom domain; if you add a custom domain, update the `adamarledge.github.io` URLs in `<head>`.
