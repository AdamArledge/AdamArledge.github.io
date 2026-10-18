// Rotating ASCII versions of the Y2K shapes. Each <canvas class="ascii-shape">
// re-draws its shape at a new angle every frame into a tiny hidden canvas, then
// draws one character per cell chosen by how much of the cell the shape covers.
// The shape turns while the characters stay upright.
//
//   data-shape   id of a <symbol id="shape-..."> in the page's SVG defs
//   data-motion  "spin" (turns flat) or "flip" (turns on its vertical axis like a coin)
//   data-tone    "dark" (light characters, for dark sections) or "light"
(function () {
  "use strict";

  var els = document.querySelectorAll(".ascii-shape");
  if (!els.length || !document.createElement("canvas").getContext) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var RAMP = " .:-=+*#%@";
  var TONES = {
    dark: ["#5d5c55", "#6b6f64", "#808F7B", "#949d8a", "#A9AA9C", "#BDBAAD", "#CEC9BC", "#D9D5CC", "#E5E1DC", "#F7F4EF"],
    light: ["#979086", "#8a8276", "#7a7063", "#6b6458", "#5c5145", "#46372A", "#3d342b", "#2F2D29", "#221f1c", "#141311"]
  };
  var FPS = 15;

  var items = Array.prototype.map.call(els, function (el) {
    var symbol = document.getElementById("shape-" + el.dataset.shape);
    var parts = symbol ? Array.prototype.map.call(symbol.querySelectorAll("path"), function (p) {
      return {
        path: new Path2D(p.getAttribute("d")),
        stroke: p.getAttribute("fill") === "none",
        width: parseFloat(p.getAttribute("stroke-width")) || 0,
        rule: p.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero"
      };
    }) : [];
    var off = document.createElement("canvas");
    return {
      el: el, ctx: el.getContext("2d"), parts: parts,
      off: off, octx: off.getContext("2d", { willReadFrequently: true }),
      flip: el.dataset.motion === "flip",
      tone: TONES[el.dataset.tone] || TONES.dark,
      speed: parseFloat(el.dataset.speed) || (el.dataset.motion === "flip" ? 0.9 : 0.3),
      phase: Math.random() * Math.PI * 2,
      visible: false
    };
  });

  function size(it) {
    var r = it.el.getBoundingClientRect();
    if (!r.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    it.w = r.width; it.h = r.height; it.dpr = dpr;
    it.el.width = Math.round(r.width * dpr);
    it.el.height = Math.round(r.height * dpr);
    // Smaller shapes get smaller type so there are enough cells to read the shape
    it.font = Math.max(8, Math.min(12, Math.round(r.width / 15)));
    it.ctx.font = it.font + "px 'Space Mono', monospace";
    it.cw = it.ctx.measureText("M").width;
    it.ch = Math.round(it.font * 1.2);
    it.cols = Math.floor(r.width / it.cw);
    it.rows = Math.floor(r.height / it.ch);
    it.off.width = it.cols * 2;   // 2x2 samples per character cell
    it.off.height = it.rows * 2;
  }

  function draw(it, t) {
    if (!it.cols || !it.parts.length) return;
    var a = it.phase + t * it.speed;
    var o = it.octx, ow = it.off.width, oh = it.off.height;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, ow, oh);
    // Shapes live in a 100x100 box; turning in that space, then scaling to the
    // cell grid, matches turning on screen because the canvas box is square.
    o.setTransform(ow / 100, 0, 0, oh / 100, 0, 0);
    o.translate(50, 50);
    if (it.flip) o.scale(Math.cos(a), 1);
    else o.rotate(a);
    o.translate(-50, -50);
    o.fillStyle = o.strokeStyle = "#fff";
    for (var i = 0; i < it.parts.length; i++) {
      var p = it.parts[i];
      if (p.stroke) { o.lineWidth = p.width * 1.4; o.stroke(p.path); }
      else o.fill(p.path, p.rule);
    }
    var px = o.getImageData(0, 0, ow, oh).data, row = ow * 4;
    var back = it.flip && Math.cos(a) < 0; // seeing the back of a flipping shape: dimmer

    var c = it.ctx;
    c.setTransform(it.dpr, 0, 0, it.dpr, 0, 0);
    c.clearRect(0, 0, it.w, it.h);
    c.font = it.font + "px 'Space Mono', monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (var y = 0; y < it.rows; y++) {
      for (var x = 0; x < it.cols; x++) {
        var k = y * 2 * row + x * 8;
        var cov = (px[k + 3] + px[k + 7] + px[k + row + 3] + px[k + row + 7]) / 1020;
        if (cov < 0.08) continue;
        // Edges use coverage so the outline stays crisp; the solid interior gets a
        // diagonal band of light that sweeps across as the shape turns, like a glint on chrome
        var level = cov < 0.9 ? Math.floor(cov * 10)
          : 3 + Math.round(6 * (0.5 + 0.5 * Math.sin((x / it.cols + y / it.rows) * 5 + a * 2)));
        level = Math.min(9, level);
        c.fillStyle = it.tone[back ? Math.max(0, level - 4) : level];
        c.fillText(RAMP[Math.max(1, level)], x * it.cw + it.cw / 2, y * it.ch + it.ch / 2);
      }
    }
  }

  // ---------- Loop: one shared timer, only shapes on screen are redrawn ----------
  var running = false, last = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    for (var i = 0; i < items.length; i++) if (items[i].visible) draw(items[i], now / 1000);
  }
  function update() {
    var go = !document.hidden && !reduceMotion.matches && items.some(function (it) { return it.visible; });
    if (go && !running) { running = true; requestAnimationFrame(frame); }
    if (!go) running = false;
  }
  function all() {
    items.forEach(function (it) { size(it); draw(it, 0); }); // also the still frame for reduced motion
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        items.forEach(function (it) { if (it.el === e.target) it.visible = e.isIntersecting; });
      });
      update();
    });
    items.forEach(function (it) { io.observe(it.el); });
  } else {
    items.forEach(function (it) { it.visible = true; });
  }
  document.addEventListener("visibilitychange", update);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", update);
  else reduceMotion.addListener(update);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(all, 150);
  });

  all();
  update();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();
