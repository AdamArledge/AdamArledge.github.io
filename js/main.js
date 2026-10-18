// Builds the content-driven parts of the page from js/content.js, then wires up
// the mobile menu and the photo viewer. No dependencies.
(function () {
  "use strict";

  var C = window.SITE_CONTENT || {};
  var root = document.documentElement;
  root.classList.add("js");

  // ---------- Small helpers ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function has(v) { return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ""; }

  // el("p", { class: "x" }, "text", childNode, ...) — text is always set as text, never parsed as HTML
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === false || attrs[k] == null) return;
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    });
    [].concat(kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }
  function srOnly(text) { return el("span", { class: "visually-hidden", text: text }); }

  // Show the sections (and their menu links) that need content, e.g. data-requires="gallery"
  function reveal(key) {
    $$('[data-requires="' + key + '"]').forEach(function (n) { n.hidden = false; });
  }

  // ---------- Booking links ----------
  var booking = C.booking || {};
  var online = has(booking.url);
  root.setAttribute("data-booking", online ? "online" : "offline");
  $$("[data-online]").forEach(function (n) { n.hidden = !online; });
  $$("[data-offline]").forEach(function (n) { n.hidden = online; });

  if (online) {
    var consultUrl = has(booking.consultationUrl) ? booking.consultationUrl : booking.url;
    $$("a[data-book]").forEach(function (a) {
      a.href = a.getAttribute("data-book") === "consult" ? consultUrl : booking.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = a.getAttribute("data-label-online") || a.textContent;
      a.appendChild(srOnly(/vagaro/i.test(a.textContent) ? " (opens in a new tab)" : " (opens Vagaro in a new tab)"));
    });
    // With a direct consultation link there is nothing to pick on Vagaro
    if (has(booking.consultationUrl)) {
      $$("[data-consult-hint]").forEach(function (n) { n.textContent = "Both open Vagaro in a new tab."; });
    }
  }

  // ---------- Social links ----------
  var social = (C.social || []).filter(function (s) { return has(s.url); });
  var instagram = social.filter(function (s) { return /instagram/i.test(s.label); })[0];
  if (instagram) $$("[data-social-link]").forEach(function (a) { a.href = instagram.url; });
  var socialList = $("[data-social-list]");
  if (socialList && social.length) {
    socialList.textContent = "";
    social.forEach(function (s) {
      socialList.appendChild(el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener" },
        [s.label + (has(s.handle) ? " " + s.handle : ""), srOnly(" (opens in a new tab)")])));
    });
  }

  // ---------- Services ----------
  var servicesBox = $("[data-services]");
  if (servicesBox && has(C.services)) {
    servicesBox.textContent = "";
    C.services.forEach(function (group, gi) {
      var id = "service-group-" + (gi + 1);
      var list = el("ul", { class: "service-list" });
      (group.items || []).forEach(function (s) {
        var meta = [];
        if (has(s.price)) meta.push(el("span", {}, [srOnly("Price: "), s.price]));
        if (has(s.duration)) meta.push(el("span", {}, [srOnly("Time: "), s.duration]));
        list.appendChild(el("li", { class: "service" }, [
          el("div", { class: "service__text" }, [
            el("h4", { class: "service__name", text: s.name }),
            has(s.alsoKnownAs) ? el("p", { class: "service__aka", text: "Also called " + s.alsoKnownAs.toLowerCase() }) : null,
            has(s.description) ? el("p", { class: "service__desc", text: s.description }) : null,
            has(s.note) ? el("p", { class: "service__note", text: s.note }) : null
          ]),
          meta.length ? el("p", { class: "service__meta" }, meta) : null,
          // Only services with their own Vagaro link get a button here; otherwise
          // the section-level buttons are the honest route
          has(s.bookingUrl) ? el("a", { class: "link-arrow service__book", href: s.bookingUrl, target: "_blank", rel: "noopener" },
            ["Book", srOnly(" " + s.name + " (opens Vagaro in a new tab)"), el("span", { class: "link-arrow__icon", "aria-hidden": "true", text: "→" })]) : null
        ]));
      });
      servicesBox.appendChild(el("div", { class: "service-group", role: "group", "aria-labelledby": id }, [
        el("h3", { class: "service-group__title", id: id, text: group.group }),
        list
      ]));
    });
  }

  // ---------- About ----------
  var about = C.about || {};
  var aboutBox = $("[data-about]");
  if (aboutBox && has(about.paragraphs)) {
    about.paragraphs.forEach(function (p) { aboutBox.appendChild(el("p", { text: p })); });
  }
  var portraitBox = $("[data-portrait]");
  if (portraitBox && about.portrait && has(about.portrait.src)) {
    portraitBox.appendChild(el("img", {
      src: about.portrait.src, alt: about.portrait.alt || "", width: about.portrait.width, height: about.portrait.height,
      loading: "lazy", decoding: "async"
    }));
    portraitBox.hidden = false;
    portraitBox.parentNode.classList.add("about__layout--portrait");
  }

  // ---------- Reviews ----------
  var reviewBox = $("[data-reviews]");
  var reviews = (C.reviews || []).filter(function (r) { return has(r.quote) && has(r.name); });
  if (reviewBox && reviews.length) {
    reviews.forEach(function (r) {
      reviewBox.appendChild(el("li", { class: "review" }, el("figure", {}, [
        el("blockquote", { class: "review__quote" }, el("p", { text: r.quote })),
        el("figcaption", { class: "review__by" }, [r.name, has(r.source) ? el("span", { class: "review__source", text: " via " + r.source }) : null])
      ])));
    });
    reveal("reviews");
  }

  // ---------- Contact details (Visit section) ----------
  var contact = C.contact || {};
  var contactBox = $("[data-contact]");
  if (contactBox) {
    var rows = [];
    if (has(contact.phoneDisplay) && has(contact.phoneDigits)) {
      rows.push(el("div", {}, [el("dt", { text: "Phone" }), el("dd", {}, el("a", { href: "tel:+1" + String(contact.phoneDigits).replace(/\D/g, ""), text: contact.phoneDisplay }))]));
    }
    if (has(contact.email)) {
      rows.push(el("div", {}, [el("dt", { text: "Email" }), el("dd", {}, el("a", { href: "mailto:" + contact.email, text: contact.email }))]));
    }
    if (rows.length) contactBox.appendChild(el("dl", { class: "detail-list" }, rows));

    if (has(contact.hours)) {
      contactBox.appendChild(el("h3", { class: "visit__label", text: "Hours" }));
      contactBox.appendChild(el("dl", { class: "detail-list detail-list--hours" }, contact.hours.map(function (h) {
        return el("div", {}, [el("dt", { text: h.days }), el("dd", { text: h.time })]);
      })));
    }
    if (has(contact.visitNotes)) {
      contactBox.appendChild(el("ul", { class: "visit__notes" }, contact.visitNotes.map(function (n) { return el("li", { text: n }); })));
    }
  }

  // ---------- Structured data: add confirmed extras ----------
  var ld = $("#business-jsonld");
  if (ld) {
    try {
      var data = JSON.parse(ld.textContent);
      if (has(contact.phoneDigits)) data.telephone = "+1" + String(contact.phoneDigits).replace(/\D/g, "");
      if (has(contact.email)) data.email = contact.email;
      var specs = (contact.hours || []).filter(function (h) { return h.schema; }).map(function (h) {
        return Object.assign({ "@type": "OpeningHoursSpecification" }, h.schema);
      });
      if (specs.length) data.openingHoursSpecification = specs;
      if (social.length) data.sameAs = social.map(function (s) { return s.url; });
      if (online) data.potentialAction = { "@type": "ReserveAction", target: booking.url };
      ld.textContent = JSON.stringify(data, null, 2);
    } catch (e) { /* leave the static block as it is */ }
  }

  // ---------- Mobile menu ----------
  var toggle = $(".nav__toggle");
  var menu = $("#nav-menu");
  var nav = $(".nav");
  var desktop = window.matchMedia("(min-width: 56.25em)");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  }
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });
  // Close when focus or a click moves outside the menu
  nav.addEventListener("focusout", function (e) {
    if (menu.classList.contains("is-open") && e.relatedTarget && !nav.contains(e.relatedTarget)) setMenu(false);
  });
  document.addEventListener("click", function (e) {
    if (menu.classList.contains("is-open") && !nav.contains(e.target)) setMenu(false);
  });
  var onBreakpoint = function () { if (desktop.matches) setMenu(false); };
  if (desktop.addEventListener) desktop.addEventListener("change", onBreakpoint);
  else desktop.addListener(onBreakpoint);

  // ---------- Selected work + photo viewer ----------
  var gallery = (C.gallery || []).filter(function (g) { return has(g.src) && has(g.alt); });
  var grid = $("[data-gallery]");
  var dialog = $(".lightbox");

  if (grid && dialog && gallery.length) {
    var big = $(".lightbox__img", dialog);
    var caption = $(".lightbox__caption", dialog);
    var count = $(".lightbox__count", dialog);
    var steps = $$("[data-step]", dialog);
    var current = 0;
    var opener = null;

    gallery.forEach(function (g, i) {
      var btn = el("button", { class: "work-item__btn", type: "button", "aria-haspopup": "dialog" }, [
        el("img", { src: g.src, alt: g.alt, width: g.width, height: g.height, loading: "lazy", decoding: "async" }),
        srOnly(" (view larger)")
      ]);
      btn.addEventListener("click", function () {
        opener = btn;
        show(i);
        dialog.showModal();
        $("[data-close]", dialog).focus();
      });
      grid.appendChild(el("li", { class: "work-item" }, el("figure", {}, [
        btn,
        has(g.caption) ? el("figcaption", { class: "work-item__caption", text: g.caption }) : null
      ])));
    });
    reveal("gallery");

    // A single photo needs no previous/next
    steps.forEach(function (b) { b.hidden = gallery.length < 2; });

    var show = function (i) {
      current = (i + gallery.length) % gallery.length;
      var g = gallery[current];
      big.src = g.full || g.src;
      big.alt = g.alt;
      if (g.width && g.height) { big.width = g.width; big.height = g.height; }
      caption.textContent = g.caption || "";
      caption.hidden = !has(g.caption);
      count.textContent = gallery.length > 1 ? "Photo " + (current + 1) + " of " + gallery.length : "";
    };

    steps.forEach(function (b) {
      b.addEventListener("click", function () { show(current + Number(b.getAttribute("data-step"))); });
    });
    $("[data-close]", dialog).addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("keydown", function (e) {
      if (gallery.length < 2) return;
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });
    // A click on the backdrop (outside the frame) closes the viewer
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      if (opener) opener.focus();
    });
  }

  // ---------- Footer year ----------
  var year = $("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
