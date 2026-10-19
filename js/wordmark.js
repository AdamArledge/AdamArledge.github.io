// Opening assembly for the hero wordmark. The finished wordmark is already in
// the page as SVG (scripts/wordmark.py draws it); this lays a copy over it,
// cut into a modest number of clean, slanted fragments with clip-paths, starts
// them displaced and draws them together in about a second. When they land,
// the copy is removed and the original, seamless SVG is shown in the same
// frame, so no cut lines are ever left behind.
//
// Plays once per page load. Skipped under "reduce motion", and if the page
// took so long that the CSS has already shown the wordmark (after 3s).
(function () {
  "use strict";

  var art = document.querySelector(".hero__art");
  if (!art) return;

  var SVG = "http://www.w3.org/2000/svg";
  var CELL = 95;          // fragment width, in wordmark units (100 = capital height)
  var ROW = 70;           // fragment height, in the same units
  var SLANT = 14;         // degrees; the cuts lean with the letters
  var SCATTER = 110;      // how far fragments start from home, in the same units
  var TURN = 12;          // largest starting rotation, in degrees
  var STAGGER = 180;      // ms; fragments further right start a little later
  var MOVE_MIN = 760;     // ms; each fragment's travel time
  var MOVE_MAX = 860;

  function done() {
    art.classList.add("is-assembled");
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || performance.now() > 2500 || !Element.prototype.animate) {
    done();
    return;
  }

  // The variant on screen (two lines or one), and its geometry
  var shown = Array.prototype.filter.call(art.querySelectorAll(".wordmark-art"), function (svg) {
    return getComputedStyle(svg).display !== "none";
  })[0];
  var source = shown && shown.querySelector("use");
  if (!source || !shown.viewBox || !shown.viewBox.baseVal) {
    done();
    return;
  }
  var box = shown.viewBox.baseVal;
  var W = box.width, H = box.height;
  var href = source.getAttribute("href");

  function el(name, attrs) {
    var node = document.createElementNS(SVG, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // The overlay: same viewBox, laid exactly over the shown SVG
  var a = art.getBoundingClientRect(), s = shown.getBoundingClientRect();
  var overlay = el("svg", { "class": "hero__pieces", viewBox: "0 0 " + W + " " + H, "aria-hidden": "true", focusable: "false" });
  overlay.style.left = s.left - a.left + "px";
  overlay.style.top = s.top - a.top + "px";
  overlay.style.width = s.width + "px";
  overlay.style.height = s.height + "px";
  var defs = el("defs", {});
  overlay.appendChild(defs);

  // Cut lines: a grid of slanted columns and rows whose inner corners are
  // nudged at random, so the fragments are irregular but tile exactly
  var cols = Math.max(3, Math.round(W / CELL)), rows = Math.max(1, Math.round(H / ROW));
  var lean = Math.tan(SLANT * Math.PI / 180);
  var pts = [];
  for (var j = 0; j <= rows; j++) {
    pts.push([]);
    for (var i = 0; i <= cols; i++) {
      var inner = i > 0 && i < cols && j > 0 && j < rows;
      var y = j === 0 ? -H : j === rows ? 2 * H : (j + (inner ? (Math.random() - 0.5) * 0.4 : 0)) * H / rows;
      var x = i === 0 ? -W : i === cols ? 2 * W : (i + (Math.random() - 0.5) * 0.5) * W / cols + (H / 2 - y) * lean;
      pts[j].push([x, y]);
    }
  }

  var id = "wm-" + Math.random().toString(36).slice(2, 8);
  var animations = [];
  for (j = 0; j < rows; j++) {
    for (i = 0; i < cols; i++) {
      var quad = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
      var clip = el("clipPath", { id: id + "-" + j + "-" + i, clipPathUnits: "userSpaceOnUse" });
      clip.appendChild(el("polygon", { points: quad.map(function (p) { return p[0] + "," + p[1]; }).join(" ") }));
      defs.appendChild(clip);

      var cut = el("g", { "clip-path": "url(#" + clip.id + ")" });
      cut.appendChild(el("use", { href: href, width: W, height: H }));
      var piece = el("g", {});
      piece.appendChild(cut);
      overlay.appendChild(piece);

      // Home is the fragment's centre (clamped into the wordmark); it starts
      // pushed out around it and turned a little, then eases in with no overshoot
      var cx = Math.min(W, Math.max(0, (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4));
      var cy = Math.min(H, Math.max(0, (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4));
      var angle = Math.random() * 2 * Math.PI, dist = SCATTER * (0.45 + 0.55 * Math.random());
      piece.style.transformBox = "view-box";
      piece.style.transformOrigin = cx + "px " + cy + "px";
      animations.push(piece.animate([
        { transform: "translate(" + Math.cos(angle) * dist * 1.3 + "px," + Math.sin(angle) * dist * 0.7 + "px) rotate(" + (Math.random() - 0.5) * 2 * TURN + "deg)" },
        { transform: "none" }
      ], {
        duration: MOVE_MIN + Math.random() * (MOVE_MAX - MOVE_MIN),
        delay: STAGGER * (0.6 * cx / W + 0.4 * Math.random()),
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both"
      }));
    }
  }

  // Hand-off: show the original and drop the fragments in the same frame
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    done();
    overlay.remove();
    animations.forEach(function (anim) { anim.cancel(); });
    window.removeEventListener("resize", onResize);
  }
  // A width change mid-way (e.g. rotating a phone) skips straight to the end;
  // iOS also fires resize as its toolbar slides away, which doesn't count
  var width = window.innerWidth;
  function onResize() {
    if (window.innerWidth !== width) finish();
  }

  art.appendChild(overlay);
  Promise.all(animations.map(function (anim) { return anim.finished; })).then(finish, finish);
  window.addEventListener("resize", onResize);
})();
