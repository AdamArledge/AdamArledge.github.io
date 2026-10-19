#!/usr/bin/env node
// Builds index.html from templates/index.html + content/site.mjs.
//
//   node scripts/build.mjs           write index.html
//   node scripts/build.mjs --check   exit 1 if index.html is out of date
//
// No dependencies; needs Node 18+. The output is plain static HTML, so GitHub
// Pages serves it exactly as before; nothing runs on the server.
//
// Template syntax:
//   {{ path.to.value }}   text, HTML-escaped
//   {{{ blockName }}}     a block of HTML generated below
// Unknown names stop the build, so a typo can't ship as visible "{{...}}".

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = (await import(pathToFileURL(path.join(root, "content/site.mjs")).href + "?t=" + Date.now())).default;

// ---------- helpers ----------
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const has = (v) => Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "";
const indent = (html, n) => html.split("\n").map((l) => (l ? " ".repeat(n) + l : l)).join("\n");
const NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>';
const NEW_TAB_VAGARO = '<span class="visually-hidden"> (opens Vagaro in a new tab)</span>';
const ICON_NEW_TAB = '<svg class="icon-new-tab" viewBox="0 0 16 16" aria-hidden="true"><use href="#icon-new-tab"/></svg>';
const ext = (url, label, cls = "", sr = NEW_TAB, icon = "") =>
  `<a${cls ? ` class="${cls}"` : ""} href="${esc(url)}" target="_blank" rel="noopener">${label}${sr}${icon}</a>`;

function fail(msg) { console.error("build: " + msg); process.exit(1); }

// ---------- validate the essentials ----------
const { business: biz, booking = {}, contact = {} } = site;
if (!has(biz?.name) || !has(biz?.studio) || !has(biz?.address?.street)) fail("business name, studio and address are required");
if (!/^https:\/\//.test(booking.url || "")) fail("booking.url must be an https:// link");

const addr = biz.address;
const social = (site.social || []).filter((s) => has(s.url));
const instagram = social.find((s) => /instagram/i.test(s.label)) || social[0];
const gallery = (site.gallery || []).filter((g) => has(g.src) && has(g.alt));
const reviews = (site.reviews || []).filter((r) => has(r.quote) && has(r.name));
const firstVisit = (site.firstVisit || []).filter((s) => has(s.title) && has(s.text));
const about = site.about || {};
const portrait = about.portrait && has(about.portrait.src) ? about.portrait : null;
const allServices = (site.services || []).flatMap((g) => g.items || []);
const anyPrice = allServices.some((s) => has(s.price));
const phoneDigits = String(contact.phoneDigits || "").replace(/\D/g, "");

// ---------- text values ({{ }}) ----------
const values = {
  business: biz,
  address: { ...addr, streetName: addr.street.replace(/^\d+\s+/, "") },
  booking,
  instagram: instagram || { url: "", handle: "" },
  directionsUrl: "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${addr.street} ${addr.city} ${addr.region} ${addr.postalCode}`).replace(/%20/g, "+"),
  metaDescription: `${biz.tagline} ${biz.summary.replace(/\.$/, "")}, inside ${biz.studio} in ${addr.city}, ${addr.region}.`,
  servicesLede: anyPrice
    ? "Prices are starting points. Book online through Vagaro."
    : "Prices aren’t listed on this site yet. Book online through Vagaro.",
  bookingInstructionsInline: has(booking.instructions) ? " " + booking.instructions : "",
  aboutLayoutClass: portrait ? " about__layout--portrait" : "",
  year: new Date().getFullYear()
};

// ---------- HTML blocks ({{{ }}}) ----------
const blocks = {};

blocks.generatedNotice = "<!-- GENERATED FILE: edit templates/index.html or content/site.mjs, then run `node scripts/build.mjs`. -->";

// One span per phrase (split after commas and full stops): the tagline breaks
// only between phrases, and each phrase bleeds in on its own (js/ink.js)
// through its own SVG filter, so each soaks in with a different grain.
// The filters' animations are started by the script; until then, and once
// they finish, every primitive is at rest and the letters are untouched.
const phrases = biz.tagline.split(/(?<=[,.])\s+/);
blocks.taglineHtml = phrases.map((part, i) => `<span data-ink="${i}">${esc(part)}</span>`).join(" ");
const inkAnimate = (attr, values) =>
  `<animate attributeName="${attr}" values="${values}" keyTimes="0;0.35;1" calcMode="spline" keySplines="0.2 0.6 0.35 1;0.3 0.5 0.3 1" dur="1.8s" begin="indefinite" fill="freeze"/>`;
blocks.inkFilters = indent(phrases.map((_, i) => [
  `<filter id="ink-${i}" x="-6%" y="-25%" width="112%" height="150%" color-interpolation-filters="sRGB">`,
  `  <feMorphology operator="dilate" radius="0" result="spread">${inkAnimate("radius", "1.6;0.5;0")}</feMorphology>`,
  `  <feGaussianBlur in="spread" stdDeviation="0.001" result="wet">${inkAnimate("stdDeviation", "3.5;0.9;0.001")}</feGaussianBlur>`,
  `  <feTurbulence type="fractalNoise" baseFrequency="0.05 0.09" numOctaves="2" seed="${7 + i * 13}" result="fibres"/>`,
  `  <feDisplacementMap in="wet" in2="fibres" scale="0" xChannelSelector="R" yChannelSelector="G">${inkAnimate("scale", "16;5;0")}</feDisplacementMap>`,
  `</filter>`
].join("\n")).join("\n"), 4);

const nav = [
  gallery.length && ["#work", "Work"],
  ["#services", "Services"],
  ["#about", "About"],
  reviews.length && ["#reviews", "Reviews"],
  ["#visit", "Visit"]
].filter(Boolean);
blocks.navItems = indent(nav.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("\n"), 10);

blocks.consultButton = has(booking.consultationUrl)
  ? indent(ext(booking.consultationUrl, "Book a consultation", "btn btn--secondary", NEW_TAB_VAGARO, ICON_NEW_TAB), 12)
  : "";

blocks.servicesList = indent((site.services || []).map((group, gi) => {
  const id = `service-group-${gi + 1}`;
  const items = (group.items || []).map((s) => {
    const meta = [
      has(s.price) && `<span><span class="visually-hidden">Price: </span>${esc(s.price)}</span>`,
      has(s.duration) && `<span><span class="visually-hidden">Time: </span>${esc(s.duration)}</span>`
    ].filter(Boolean);
    return [
      `<li class="service">`,
      `  <div class="service__text">`,
      `    <h4 class="service__name">${esc(s.name)}</h4>`,
      has(s.alsoKnownAs) && `    <p class="service__aka">Also called ${esc(s.alsoKnownAs.toLowerCase())}</p>`,
      has(s.description) && `    <p class="service__desc">${esc(s.description)}</p>`,
      has(s.note) && `    <p class="service__note">${esc(s.note)}</p>`,
      `  </div>`,
      meta.length && `  <p class="service__meta">${meta.join("")}</p>`,
      // Only a link that opens this exact service gets a per-service button
      has(s.bookingUrl) && `  <a class="link-arrow service__book" href="${esc(s.bookingUrl)}" target="_blank" rel="noopener">Book ${esc(s.name)}<span class="visually-hidden"> (opens Vagaro in a new tab)</span><span class="link-arrow__icon" aria-hidden="true">&rarr;</span></a>`,
      `</li>`
    ].filter(Boolean).join("\n");
  }).join("\n");
  return [
    `<div class="service-group" role="group" aria-labelledby="${id}">`,
    `  <h3 class="service-group__title" id="${id}">${esc(group.group)}</h3>`,
    `  <ul class="service-list">`,
    indent(items, 4),
    `  </ul>`,
    `</div>`
  ].join("\n");
}).join("\n"), 10);

blocks.aboutParagraphs = indent((about.paragraphs || []).filter(has).map((p) => `<p>${esc(p)}</p>`).join("\n"), 10);
blocks.portrait = portrait
  ? indent(`<figure class="about__portrait"><img src="${esc(portrait.src)}" alt="${esc(portrait.alt)}" width="${esc(portrait.width)}" height="${esc(portrait.height)}" loading="lazy" decoding="async"></figure>`, 8)
  : "";

blocks.workSection = gallery.length ? `
    <!-- ================= SELECTED WORK ================= -->
    <section class="section work" id="work" aria-labelledby="work-title">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="work-title">Selected work</h2>
${instagram ? `          <p class="section-head__aside">More on Instagram: ${ext(instagram.url, esc(instagram.handle))}</p>` : ""}
        </div>
        <ul class="work-grid" data-gallery>
${indent(gallery.map((g, i) => [
  `<li class="work-item">`,
  `  <figure>`,
  `    <button class="work-item__btn" type="button" aria-haspopup="dialog" data-full="${esc(g.full || g.src)}" data-caption="${esc(g.caption || "")}" data-width="${esc(g.width || "")}" data-height="${esc(g.height || "")}">`,
  `      <img src="${esc(g.src)}" alt="${esc(g.alt)}" width="${esc(g.width || "")}" height="${esc(g.height || "")}" loading="${i < 2 ? "eager" : "lazy"}" decoding="async">`,
  `      <span class="visually-hidden"> (view larger)</span>`,
  `    </button>`,
  has(g.caption) && `    <figcaption class="work-item__caption">${esc(g.caption)}</figcaption>`,
  `  </figure>`,
  `</li>`
].filter(Boolean).join("\n")).join("\n"), 10)}
        </ul>
      </div>
    </section>
` : "";

blocks.lightbox = gallery.length ? `
  <!-- ================= PHOTO VIEWER ================= -->
  <dialog class="lightbox" aria-labelledby="lightbox-title">
    <div class="lightbox__frame">
      <h2 class="visually-hidden" id="lightbox-title">Photo viewer</h2>
      <figure class="lightbox__figure">
        <img class="lightbox__img" src="${esc(gallery[0].full || gallery[0].src)}" alt="">
        <figcaption class="lightbox__caption"></figcaption>
      </figure>
      <div class="lightbox__bar">
        <p class="lightbox__count" aria-live="polite"></p>
        <div class="lightbox__controls">
${gallery.length > 1 ? `          <button class="lightbox__btn" type="button" data-step="-1"><span aria-hidden="true">&larr;</span> Previous</button>
          <button class="lightbox__btn" type="button" data-step="1">Next <span aria-hidden="true">&rarr;</span></button>
` : ""}          <button class="lightbox__btn lightbox__btn--close" type="button" data-close>Close</button>
        </div>
      </div>
    </div>
  </dialog>
` : "";

blocks.reviewsSection = reviews.length ? `
    <!-- ================= REVIEWS ================= -->
    <section class="section reviews" id="reviews" aria-labelledby="reviews-title">
      <div class="container">
        <h2 class="section-title" id="reviews-title">From clients</h2>
        <ul class="review-list">
${indent(reviews.map((r) => [
  `<li class="review">`,
  `  <figure>`,
  `    <blockquote class="review__quote"><p>${esc(r.quote)}</p></blockquote>`,
  `    <figcaption class="review__by">${esc(r.name)}${has(r.source) ? `<span class="review__source"> via ${esc(r.source)}</span>` : ""}</figcaption>`,
  `  </figure>`,
  `</li>`
].join("\n")).join("\n"), 10)}
        </ul>
      </div>
    </section>
` : "";

blocks.firstVisitSection = firstVisit.length ? `
    <!-- ================= FIRST VISIT ================= -->
    <section class="section first-visit" aria-labelledby="first-visit-title">
      <div class="container">
        <h2 class="section-title" id="first-visit-title">Your first visit</h2>
        <ol class="steps">
${indent(firstVisit.map((s) => `<li class="step">\n  <h3 class="step__title">${esc(s.title)}</h3>\n  <p>${esc(s.text)}</p>\n</li>`).join("\n"), 10)}
        </ol>
      </div>
    </section>
` : "";

blocks.moreLinksItem = site.moreLinks && has(site.moreLinks.url)
  ? indent(`<li>${ext(site.moreLinks.url, `${esc(site.moreLinks.label || "More links")}<span class="link-arrow__icon" aria-hidden="true">&rarr;</span>`, "link-arrow link-arrow--light")}</li>`, 12)
  : "";

{
  const out = [];
  const rows = [];
  if (has(contact.phoneDisplay) && phoneDigits) rows.push(["Phone", `<a href="tel:+1${phoneDigits}">${esc(contact.phoneDisplay)}</a>`]);
  if (has(contact.email)) rows.push(["Email", `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>`]);
  if (rows.length) out.push(`<dl class="detail-list">\n${rows.map(([k, v]) => `  <div><dt>${k}</dt><dd>${v}</dd></div>`).join("\n")}\n</dl>`);
  if (has(contact.hours)) {
    out.push(`<h3 class="visit__label">Hours</h3>`);
    out.push(`<dl class="detail-list">\n${contact.hours.map((h) => `  <div><dt>${esc(h.days)}</dt><dd>${esc(h.time)}</dd></div>`).join("\n")}\n</dl>`);
  }
  if (has(contact.visitNotes)) out.push(`<ul class="visit__notes">\n${contact.visitNotes.map((n) => `  <li>${esc(n)}</li>`).join("\n")}\n</ul>`);
  blocks.contactDetails = indent(out.join("\n"), 10);
}

blocks.footerLinks = indent([
  ...social.map((s) => `<li>${ext(s.url, esc(s.label + (has(s.handle) ? " " + s.handle : "")))}</li>`),
  site.moreLinks && has(site.moreLinks.url) && `<li>${ext(site.moreLinks.url, esc(site.moreLinks.label || "More links"))}</li>`
].filter(Boolean).join("\n"), 8);

// Structured data: confirmed facts only
{
  const data = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: biz.name,
    description: `${biz.tagline} ${biz.summary}`,
    url: biz.siteUrl,
    image: biz.siteUrl + "images/og-image.jpg",
    address: {
      "@type": "PostalAddress",
      streetAddress: addr.street,
      addressLocality: addr.city,
      addressRegion: addr.region,
      postalCode: addr.postalCode,
      addressCountry: "US"
    },
    containedInPlace: { "@type": "Place", name: biz.studio },
    potentialAction: { "@type": "ReserveAction", target: booking.url }
  };
  if (phoneDigits) data.telephone = "+1" + phoneDigits;
  if (has(contact.email)) data.email = contact.email;
  const specs = (contact.hours || []).filter((h) => h.schema).map((h) => ({ "@type": "OpeningHoursSpecification", ...h.schema }));
  if (specs.length) data.openingHoursSpecification = specs;
  const sameAs = [...social.map((s) => s.url), site.moreLinks?.url].filter(has);
  if (sameAs.length) data.sameAs = sameAs;
  // "</" can't appear inside a <script> block
  blocks.jsonLd = indent(JSON.stringify(data, null, 2).replace(/<\//g, "<\\/"), 2);
}

// ---------- render ----------
const template = await readFile(path.join(root, "templates/index.html"), "utf8");
const lookup = (p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), values);

// Blocks are swapped for markers first so text values are never re-scanned
const held = [];
let html = template
  .replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, name) => {
    if (!(name in blocks)) fail(`unknown block {{{${name}}}}`);
    held.push(blocks[name]);
    return `\u0000${held.length - 1}\u0000`;
  })
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    const v = lookup(p);
    if (v === undefined || typeof v === "object") fail(`unknown value {{${p}}}`);
    return esc(v);
  })
  .replace(/\u0000(\d+)\u0000/g, (_, i) => held[i])
  // Tidy blank lines left by empty blocks
  .replace(/\n[ \t]+\n/g, "\n\n").replace(/\n{3,}/g, "\n\n");

const outFile = path.join(root, "index.html");
if (process.argv.includes("--check")) {
  const current = await readFile(outFile, "utf8").catch(() => "");
  // The copyright year is the only value that changes on its own
  const norm = (s) => s.replace(/data-year>\d{4}/, "data-year>YEAR");
  if (norm(current) !== norm(html)) { console.error("build: index.html is out of date. Run: node scripts/build.mjs"); process.exit(1); }
  console.log("build: index.html is up to date");
} else {
  await writeFile(outFile, html);
  console.log(`build: wrote index.html (${gallery.length} photos, ${allServices.length} services, ${reviews.length} reviews)`);
}
