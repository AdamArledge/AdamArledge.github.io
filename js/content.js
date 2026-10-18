// ============================================================================
// AAHairArtistry — editable business content
// ----------------------------------------------------------------------------
// Everything that changes from time to time lives here: booking links, contact
// details, services, photos, reviews. js/main.js reads this file and builds the
// matching parts of the page. Leave a value empty ("" or []) and that piece is
// left off the page rather than shown as a blank or a placeholder.
//
// Only put in facts the business has confirmed.
//
// The business name, tagline, hero description and the Ideation Spa address are
// written directly in index.html (hero, first-visit steps, Visit section, footer
// and the business data in <head>) so they load instantly. If the studio name
// or address ever changes, search index.html for "Ideation Spa" / "Broad Street".
// ============================================================================
window.SITE_CONTENT = {
  booking: {
    // Adam's Vagaro booking page, e.g. "https://www.vagaro.com/yourbusiness".
    // Every "Book" button uses it. While it is empty, booking buttons lead to
    // a short panel that says online booking isn't linked yet and points to Instagram.
    url: "",
    // Optional: a Vagaro link that opens straight to the consultation service.
    // If empty, the consultation button uses the main booking link and tells
    // visitors to pick "Consultation" in Vagaro.
    consultationUrl: ""
  },

  contact: {
    phoneDisplay: "",   // e.g. "(803) 555-0123"
    phoneDigits: "",    // e.g. "8035550123" (used for tap-to-call)
    email: "",
    // e.g. [{ days: "Tue–Fri", time: "10am–7pm", schema: { dayOfWeek: ["Tuesday","Wednesday","Thursday","Friday"], opens: "10:00", closes: "19:00" } }]
    // "schema" is optional and only feeds Google's business listing.
    hours: [],
    // Free text shown under the address, e.g. parking or which entrance to use.
    visitNotes: []
  },

  social: [
    { label: "Instagram", handle: "@adamarledge", url: "https://www.instagram.com/adamarledge/" }
  ],

  // Services, grouped. Per service:
  //   name, alsoKnownAs (optional secondary term), description (one sentence),
  //   price (e.g. "From $65"), duration (e.g. "About 1 hr"),
  //   note (booking requirement or inclusion, shown beside the service),
  //   bookingUrl (only if Vagaro has a direct link to this exact service).
  // Empty fields are skipped, so nothing shows until it is confirmed.
  services: [
    {
      group: "Cuts & styling",
      items: [
        { name: "Cut & Style", description: "A haircut, finished and styled.", price: "", duration: "", note: "", bookingUrl: "" },
        { name: "Blowout", description: "A blow-dry style, no cut.", price: "", duration: "", note: "", bookingUrl: "" }
      ]
    },
    {
      group: "Color",
      items: [
        { name: "All-over Color", alsoKnownAs: "Single-process color", description: "One color applied from roots to ends.", price: "", duration: "", note: "", bookingUrl: "" },
        { name: "Highlights & Balayage", description: "Lighter pieces for dimension, foiled or hand-painted.", price: "", duration: "", note: "Going a lot lighter? Start with a consultation.", bookingUrl: "" },
        { name: "Vivid Color", description: "Fashion shades: electric blues, punk pinks and the rest of the loud end.", price: "", duration: "", note: "New to vivids or starting from dark hair? Start with a consultation.", bookingUrl: "" }
      ]
    },
    {
      group: "Planning",
      items: [
        { name: "Consultation", description: "Talk through a cut or color change with Adam before you book it.", price: "", duration: "", note: "", bookingUrl: "" }
      ]
    }
  ],

  // Portfolio photos. Add 4–6 of Adam's own photos to images/work/ and list
  // them here; the "Work" section and its menu link appear automatically.
  //   { src: "images/work/copper-shag.jpg", width: 900, height: 1200,
  //     alt: "Shoulder-length copper shag with curtain bangs, seen from the side",
  //     caption: "Copper shag" }
  // Portrait (3:4) photos around 900×1200, under ~250 KB each, work best.
  gallery: [],

  about: {
    // Short paragraphs in Adam's voice: background, specialties, what an
    // appointment is like. Leave empty to show only the confirmed basics.
    paragraphs: [],
    // { src: "images/adam.jpg", width: 900, height: 1200, alt: "Adam Arledge in the studio" }
    portrait: null
  },

  // Real client reviews only, with permission.
  //   { quote: "...", name: "Jordan M.", source: "Google" }
  // The section appears once at least one is added.
  reviews: []
};
