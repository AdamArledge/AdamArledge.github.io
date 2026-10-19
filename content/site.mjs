// ============================================================================
// AAHairArtistry — the one place to edit business content
// ----------------------------------------------------------------------------
// After editing, rebuild the page:   node scripts/build.mjs
// That rewrites index.html from templates/index.html + this file. Commit both
// this file and the regenerated index.html.
//
// Only put in facts the business has confirmed. Leave a value empty ("" or [])
// and that piece is left off the page: no blank slots, no placeholder text.
// ============================================================================
export default {
  business: {
    name: "AAHairArtistry",
    stylist: "Adam Arledge",
    tagline: "Sharp Cuts. Loud Color. Never Boring.",
    summary: "Haircuts, color, highlights and balayage, and vivid color by Adam Arledge.",
    // NOTE: Vagaro lists this business as "Ideation Spa Salon" and its website
    // as "Ideation Professionals". Confirm which name to show, then change it here.
    studio: "Ideation Spa",
    address: {
      street: "1042 Broad Street",
      city: "Camden",
      region: "SC",
      postalCode: "29020"
    },
    siteUrl: "https://adamarledge.github.io/"
  },

  booking: {
    // General booking page on Vagaro. Every "Book an appointment" button uses it.
    url: "https://www.vagaro.com/ideationpros/book-now",
    // Optional: a Vagaro link that opens straight to the consultation service.
    // Only when this is set does a separate "Book a consultation" button appear.
    consultationUrl: "",
    // Optional one-line instruction shown under the booking buttons once the
    // flow has been checked, e.g. "On Vagaro, choose Adam Arledge as your professional."
    instructions: ""
  },

  // Official link page (secondary; booking always goes straight to Vagaro)
  moreLinks: { label: "More links on Linktree", url: "https://linktr.ee/AAHairArtistry" },

  social: [
    { label: "Instagram", handle: "@adamarledge", url: "https://www.instagram.com/adamarledge/" }
  ],

  contact: {
    phoneDisplay: "",   // e.g. "(803) 555-0123" (Adam's own line, not the salon's, unless he says otherwise)
    phoneDigits: "",    // e.g. "8035550123"
    email: "",
    // e.g. [{ days: "Tue–Fri", time: "10am–7pm", schema: { dayOfWeek: ["Tuesday","Wednesday","Thursday","Friday"], opens: "10:00", closes: "19:00" } }]
    hours: [],
    // Parking, entrance, accessibility — one short sentence each
    visitNotes: []
  },

  // Services, grouped. Per service:
  //   name, alsoKnownAs (optional), description (one sentence),
  //   price (e.g. "From $65"), duration (e.g. "About 1 hr"),
  //   note (booking requirement or what's included, shown beside the service),
  //   bookingUrl (only a Vagaro link that opens this exact service).
  services: [
    {
      group: "Cuts & styling",
      items: [
        { name: "Cut & Style", description: "A haircut, finished and styled." },
        { name: "Blowout", description: "A blow-dry style, no cut." }
      ]
    },
    {
      group: "Color",
      items: [
        { name: "All-over Color", alsoKnownAs: "Single-process color", description: "One color applied from roots to ends." },
        { name: "Highlights & Balayage", description: "Lighter pieces for dimension, foiled or hand-painted." },
        { name: "Vivid Color", description: "Fashion shades: electric blues, punk pinks and the rest of the loud end." }
      ]
    },
    {
      group: "Planning",
      items: [
        { name: "Consultation", description: "A conversation about a cut or color change before the appointment itself." }
      ]
    }
  ],

  // "Your first visit" steps. The section appears once there is at least one.
  //   { title: "Bring photos", text: "..." }
  firstVisit: [],

  // Portfolio. Put photos in images/work/; the Work section and menu link
  // appear once there is at least one. Portrait photos about 900×1200.
  //   { src: "images/work/copper-shag.jpg", width: 900, height: 1200,
  //     alt: "Shoulder-length copper shag with curtain bangs, seen from the side",
  //     caption: "Copper shag" }
  gallery: [],

  about: {
    paragraphs: [],
    // { src: "images/adam.jpg", width: 900, height: 1200, alt: "Adam Arledge in the studio" }
    portrait: null
  },

  // Real client reviews only, with permission: { quote, name, source }
  reviews: []
};
