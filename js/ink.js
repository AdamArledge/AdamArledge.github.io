// Ink bleed for the hero tagline. Each phrase soaks in like ink on paper:
// a swollen, feathered blot with fibrous edges that draws in to crisp
// letters. The look is an SVG filter per phrase (generated into the page by
// scripts/build.mjs); this starts them, staggered, once the tagline's font
// has loaded, and removes the filters when they've finished so the text ends
// up exactly as normal. Skipped under "reduce motion".
(function () {
  "use strict";

  var tagline = document.querySelector(".hero__tagline");
  if (!tagline || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var START = 0.1;    // seconds before the first phrase, and between phrases
  var STEP = 0.42;    // (keep in step with the animation-delay in css/styles.css)
  var DURATION = 1.8; // each phrase's bleed (the filters' dur)
  var phrases = tagline.querySelectorAll("[data-ink]");

  function start() {
    Array.prototype.forEach.call(phrases, function (span, i) {
      var filter = document.getElementById("ink-" + span.getAttribute("data-ink"));
      if (!filter || !filter.querySelector("animate").beginElementAt) return;
      span.style.setProperty("--ink-order", i);
      span.style.filter = "url(#" + filter.id + ")";
      Array.prototype.forEach.call(filter.querySelectorAll("animate"), function (a) {
        a.beginElementAt(START + i * STEP);
      });
    });
    tagline.classList.add("is-bleeding");
    // Back to plain text once every phrase has dried
    setTimeout(function () {
      Array.prototype.forEach.call(phrases, function (span) { span.style.filter = ""; });
    }, (START + (phrases.length - 1) * STEP + DURATION) * 1000 + 100);
  }

  // Wait for the tagline's font so it doesn't swap mid-bleed, but not past
  // the point where the CSS gives up and shows it anyway (3s)
  var started = false;
  var once = function () { if (!started) { started = true; start(); } };
  if (document.fonts && document.fonts.load) {
    var style = getComputedStyle(tagline);
    document.fonts.load(style.fontStyle + " " + style.fontWeight + " 16px " + style.fontFamily, tagline.textContent).then(once, once);
    setTimeout(once, 2500);
  } else {
    once();
  }
})();
