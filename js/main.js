// Mobile nav, scroll reveal, gallery lightbox. No dependencies.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // ---------- Mobile nav ----------
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  }

  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  // Close after choosing a link, or on Escape
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });

  // ---------- Scroll reveal ----------
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // ---------- Lightbox ----------
  var dialog = document.querySelector(".lightbox");
  var big = dialog.querySelector(".lightbox__img");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile__btn"));
  var current = 0;
  var opener = null;

  function show(i) {
    current = (i + tiles.length) % tiles.length;
    var thumb = tiles[current].querySelector("img");
    big.src = tiles[current].dataset.full;
    big.alt = thumb.alt;
  }

  tiles.forEach(function (btn, i) {
    btn.addEventListener("click", function () {
      opener = btn;
      show(i);
      // <dialog> gives us a focus trap, Escape-to-close, and inert background for free
      dialog.showModal();
    });
  });

  dialog.querySelector(".lightbox__close").addEventListener("click", function () { dialog.close(); });
  dialog.querySelector(".lightbox__nav--prev").addEventListener("click", function () { show(current - 1); });
  dialog.querySelector(".lightbox__nav--next").addEventListener("click", function () { show(current + 1); });

  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  // Click on the dark area (not the photo or buttons) closes it
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });
  // Return focus to the tile that opened it
  dialog.addEventListener("close", function () {
    if (opener) opener.focus();
  });

  // ---------- Footer year ----------
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
