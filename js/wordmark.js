// Halftone wordmark: draws the hero wordmark as a grid of round printer's
// dots. Inside the letters the dots swell until they run together, leaving
// small light holes; at the edges they shrink to specks. The letter shapes are
// the wordmark's own SVG (scripts/wordmark.py), which stays in the page as the
// solid fallback and reserves the space.
//
// On page load the dots drift loose around the wordmark for a couple of
// seconds, like ink suspended in water, then gather slowly into the letters.
// The whole sequence stays under 5 seconds, so it needs no pause control, and
// it's skipped under "reduce motion".
//
// The heading's text stays in the page for screen readers and search engines;
// the canvases are decoration. Without JavaScript the solid SVG shows.
(function () {
  "use strict";

  var box = document.querySelector(".hero__art"); // holds the SVGs (line and stack)
  var canvas = document.createElement("canvas");
  if (!box || !canvas.getContext || !window.Path2D) return;
  var title = box.parentNode;

  var CELLS_PER_CAP = 14;   // dot rows across a capital letter's height (fewer = coarser, less legible)
  var DENSITY = 0.80;       // ink coverage inside the letters (1 = solid)
  var TEXTURE = 0.12;       // random variation in dot size inside the letters
  var CAP = 100;            // capital height in the SVG's units (scripts/wordmark.py)
  var MASK = 1.6;           // mask pixels per SVG unit when measuring the letters

  // Assembly animation, in ms. Every piece has landed by
  // FLOAT + GATHER_STAGGER + GATHER_MAX (keep it under 5000).
  var FADE_IN = 400;        // the loose dots fade up as the page opens
  var FLOAT = 2400;         // how long the dots drift before any start to gather
  var GATHER_STAGGER = 700; // latest start; the centre of the word gathers first
  var GATHER_MIN = 1300;    // shortest and longest gathering time
  var GATHER_MAX = 1700;
  var SCATTER = 1.1;        // how far pieces start from home, in capital-letter heights
  var DRAW_IN = 0.18;       // share of that distance the cloud closes while still floating
  var DRIFT = 0.28;         // how far they wander while floating, in capital-letter heights
  var animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  canvas.className = "hero__dots";

  // Seeded random numbers, so the texture is the same on every visit
  function random(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fill the wordmark's outline and measure how much ink falls in each cell of
  // the dot grid. The grid overhangs the SVG's box by two cells on every side
  // for the fringe of small dots. Returns the grid's size, its offset from the
  // SVG's box (in SVG units) and each cell's tone (0 to 1).
  function tones(svg) {
    var vb = svg.viewBox.baseVal;
    var shape = document.querySelector(svg.querySelector("use").getAttribute("href") + " path");
    var cell = CAP / CELLS_PER_CAP;
    var cols = Math.ceil(vb.width / cell) + 4, rows = Math.ceil(vb.height / cell) + 4;
    var gx = (vb.width - cols * cell) / 2, gy = (vb.height - rows * cell) / 2;
    var unit = cell * MASK, W = Math.ceil(cols * unit), H = Math.ceil(rows * unit);
    var ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    ctx.canvas.width = W;
    ctx.canvas.height = H;
    ctx.setTransform(MASK, 0, 0, MASK, -gx * MASK, -gy * MASK);
    ctx.fill(new Path2D(shape.getAttribute("d")), "evenodd");
    cell = unit; // from here on, in mask pixels
    var px = ctx.getImageData(0, 0, W, H).data;

    // Summed-area table of the ink, for fast averages over each cell
    var sum = new Float64Array((W + 1) * (H + 1));
    for (var y = 0; y < H; y++) {
      var run = 0;
      for (var x = 0; x < W; x++) {
        run += px[(y * W + x) * 4 + 3] / 255;
        sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + run;
      }
    }
    function ink(x0, y0, x1, y1) {
      x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
      x1 = Math.min(W, Math.round(x1)); y1 = Math.min(H, Math.round(y1));
      if (x1 <= x0 || y1 <= y0) return 0;
      var r = W + 1;
      return (sum[y1 * r + x1] - sum[y0 * r + x1] - sum[y1 * r + x0] + sum[y0 * r + x0]) / ((x1 - x0) * (y1 - y0));
    }

    // Each cell's ink, blurred slightly into its neighbours so the letters get
    // a fringe of small dots, with a little texture so the dots aren't uniform
    var rand = random(7);
    var tone = new Float32Array(cols * rows);
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var c = ink(i * cell, j * cell, (i + 1) * cell, (j + 1) * cell) * 0.6 +
                ink((i - 0.5) * cell, (j - 0.5) * cell, (i + 1.5) * cell, (j + 1.5) * cell) * 0.4;
        var t = c * c * (3 - 2 * c);
        var v = DENSITY * t + TEXTURE * (rand() - 0.5) * 2 * t * (1.2 - t);
        tone[j * cols + i] = v < 0.04 ? 0 : v;
      }
    }
    return { cols: cols, rows: rows, gx: gx, gy: gy, tone: tone };
  }

  // Draw the dots at s device pixels per cell, into a new canvas. The tone is
  // interpolated between cell centres and compared against a smooth dot
  // pattern (peaks at the cell centres, troughs at the corners): low tones
  // give small dots, middle tones give dots that touch, high tones leave only
  // small holes. Edges are antialiased.
  function paint(grid, s, color) {
    var cols = grid.cols, rows = grid.rows, tone = grid.tone;
    var W = Math.round(cols * s), H = Math.round(rows * s);
    var art = document.createElement("canvas");
    art.width = W;
    art.height = H;
    var ctx = art.getContext("2d");
    var img = ctx.createImageData(W, H);
    var data = img.data;

    function axis(n) {
      var a = { i: new Int32Array(n), f: new Float32Array(n), cos: new Float32Array(n), sin: new Float32Array(n) };
      for (var k = 0; k < n; k++) {
        var g = (k + 0.5) / s - 0.5; // position in cells, measured from the first centre
        var i = Math.floor(g);
        a.i[k] = i;
        a.f[k] = g - i;
        a.cos[k] = Math.cos(2 * Math.PI * g);
        a.sin[k] = Math.sin(2 * Math.PI * g);
      }
      return a;
    }
    var ax = axis(W), ay = axis(H);
    function at(i, j) {
      return i < 0 || j < 0 || i >= cols || j >= rows ? 0 : tone[j * cols + i];
    }
    var slope = Math.PI / s; // the pattern's steepest change per device pixel

    for (var y = 0; y < H; y++) {
      var j = ay.i[y], fy = ay.f[y], cy = ay.cos[y], sy = ay.sin[y];
      for (var x = 0; x < W; x++) {
        var i = ax.i[x], fx = ax.f[x];
        var v = (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) +
                (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
        if (v <= 0) continue;
        var f = (ax.cos[x] + cy) / 2 - (1 - 2 * v);
        var g = slope * Math.max(0.2, Math.sqrt(ax.sin[x] * ax.sin[x] + sy * sy) / Math.SQRT2);
        var a = f / g + 0.5;
        if (a <= 0) continue;
        var o = (y * W + x) * 4;
        data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2];
        data[o + 3] = a >= 1 ? 255 : a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: art, data: data, s: s };
  }

  // Draw the dots over the SVG on screen (line or stack, whichever CSS shows),
  // sized from its box. Returns what the animation needs, or null if unchanged.
  var grids = {};
  var lastKey = "";
  var place = { x: 0, y: 0 }; // the canvas's offset in the box, in CSS pixels
  function render() {
    var svg = Array.prototype.filter.call(box.querySelectorAll(".wordmark-art"), function (el) {
      return getComputedStyle(el).display !== "none";
    })[0];
    if (!svg) return null;
    var ratio = window.devicePixelRatio || 1;
    var vb = svg.viewBox.baseVal, rect = svg.getBoundingClientRect(), outer = box.getBoundingClientRect();
    var color = (getComputedStyle(title).color.match(/\d+/g) || [0, 0, 0]).map(Number);
    var key = svg.className.baseVal + "/" + rect.width + "/" + ratio + "/" + color;
    if (!rect.width || key === lastKey) return null;
    lastKey = key;
    var grid = grids[svg.className.baseVal] || (grids[svg.className.baseVal] = tones(svg));
    var k = rect.width / vb.width; // CSS pixels per SVG unit
    var art = paint(grid, CAP / CELLS_PER_CAP * k * ratio, color);
    var W = art.canvas.width, H = art.canvas.height;
    place.x = rect.left - outer.left + grid.gx * k;
    place.y = rect.top - outer.top + grid.gy * k;
    canvas.width = W;
    canvas.height = H;
    canvas.style.left = place.x + "px";
    canvas.style.top = place.y + "px";
    canvas.style.width = W / ratio + "px";
    canvas.style.height = H / ratio + "px";
    canvas.getContext("2d").drawImage(art.canvas, 0, 0);
    return { art: art, ox: 0, oy: 0, W: W, H: H, ratio: ratio };
  }

  // ---------- Assembly ----------
  // The pieces are the finished wordmark itself, cut into one tile per dot
  // cell, so at rest they rebuild it pixel for pixel. They're drawn on a
  // larger canvas laid over the wordmark (so they can start outside its box);
  // when every piece has landed, the wordmark canvas is shown and the overlay
  // removed.
  var overlay = null, frameId = 0;

  function assemble(r) {
    var art = r.art, s = art.s, data = art.data, aw = art.canvas.width;
    var cap = s * CELLS_PER_CAP;
    // Overlay margins, in device pixels: generous to the sides, small above and
    // below so the pieces stay clear of the text around the heading
    var MX = Math.round(cap * 0.9), MY = Math.round(cap * 0.3);
    var OW = r.W + 2 * MX, OH = r.H + 2 * MY;

    overlay = document.createElement("canvas");
    overlay.className = "hero__scatter";
    overlay.width = OW;
    overlay.height = OH;
    overlay.style.left = place.x - MX / r.ratio + "px";
    overlay.style.top = place.y - MY / r.ratio + "px";
    overlay.style.width = OW / r.ratio + "px";
    overlay.style.height = OH / r.ratio + "px";
    var ctx = overlay.getContext("2d");

    var pieces = [];
    var cols = Math.round(aw / s), rows = Math.round(art.canvas.height / s);
    for (var j = 0; j < rows; j++) {
      var y0 = Math.round(j * s), y1 = Math.min(art.canvas.height, Math.round((j + 1) * s));
      for (var i = 0; i < cols; i++) {
        var x0 = Math.round(i * s), x1 = Math.min(aw, Math.round((i + 1) * s));
        var inked = false;
        for (var y = y0; y < y1 && !inked; y++) {
          for (var x = x0; x < x1; x++) {
            if (data[(y * aw + x) * 4 + 3]) { inked = true; break; }
          }
        }
        if (!inked) continue;
        // Home position on the overlay, then a random start around it, kept
        // inside the overlay. Wider than tall, like ink thrown sideways.
        var hx = MX + r.ox + x0, hy = MY + r.oy + y0, w = x1 - x0, h = y1 - y0;
        var a = Math.random() * 2 * Math.PI;
        var d = cap * SCATTER * (0.25 + 0.75 * Math.pow(Math.random(), 1.4));
        var dx = Math.max(-hx, Math.min(OW - w - hx, Math.cos(a) * d * 1.4));
        var dy = Math.max(-hy, Math.min(OH - h - hy, Math.sin(a) * d * 0.75));
        var fromCentre = Math.abs(hx + w / 2 - OW / 2) / (OW / 2);
        pieces.push({
          sx: x0, sy: y0, w: w, h: h, hx: hx, hy: hy, dx: dx, dy: dy,
          // Drift: two slow sine waves per axis with random speeds and phases
          wx: drift(cap), wy: drift(cap * 0.7),
          turn: (Math.random() - 0.5) * 1.2,      // the path curves in slightly, it doesn't spin
          from: 0.45 + Math.random() * 0.35,      // smaller while loose, like a droplet
          pulse: Math.random() * 2 * Math.PI,     // phase of a slight swelling while floating
          delay: FLOAT + GATHER_STAGGER * (0.55 * fromCentre + 0.45 * Math.random()),
          move: GATHER_MIN + Math.random() * (GATHER_MAX - GATHER_MIN)
        });
      }
    }

    function drift(range) {
      var a = range * DRIFT;
      return [a * (0.5 + 0.5 * Math.random()), 0.0016 + Math.random() * 0.0022, Math.random() * 6.3,
              a * (0.2 + 0.3 * Math.random()), 0.0035 + Math.random() * 0.003, Math.random() * 6.3];
    }
    function wave(d, t) {
      return d[0] * Math.sin(d[1] * t + d[2]) + d[3] * Math.sin(d[4] * t + d[5]);
    }

    function frame(t) {
      ctx.clearRect(0, 0, OW, OH);
      ctx.globalAlpha = 0.15 + 0.85 * Math.min(1, t / FADE_IN);
      // While floating, the whole cloud slowly draws in towards the word
      var f = Math.min(1, t / FLOAT), near = 1 - DRAW_IN * f * f * (3 - 2 * f);
      var moving = false;
      for (var k = 0; k < pieces.length; k++) {
        var p = pieces[k];
        var u = Math.min(1, Math.max(0, (t - p.delay) / p.move));
        if (u < 1) moving = true;
        // How far from home, 1 to 0. Starts and ends at rest, so a piece eases
        // out of its drift, glides, then settles softly into place.
        var rest = Math.pow(1 - u, 3) * (1 + 3 * u);
        var c = Math.cos(p.turn * rest), sn = Math.sin(p.turn * rest);
        var x = (p.dx * near + wave(p.wx, t)) * rest, y = (p.dy * near + wave(p.wy, t)) * rest;
        var size = 1 - (1 - p.from * (1 + 0.12 * Math.sin(0.004 * t + p.pulse))) * rest;
        var w = p.w * size, h = p.h * size;
        var px = Math.max(0, Math.min(OW - w, p.hx + x * c - y * sn + (p.w - w) / 2));
        var py = Math.max(0, Math.min(OH - h, p.hy + x * sn + y * c + (p.h - h) / 2));
        ctx.drawImage(art.canvas, p.sx, p.sy, p.w, p.h, px, py, w, h);
      }
      return moving;
    }

    box.classList.add("is-assembling");
    box.appendChild(overlay);
    frame(0); // the first visible frame is the scattered one
    var start = null;
    frameId = requestAnimationFrame(function tick(now) {
      if (start === null) start = now;
      if (frame(now - start)) frameId = requestAnimationFrame(tick);
      else finish();
    });
  }

  function finish() {
    cancelAnimationFrame(frameId);
    if (overlay) overlay.remove();
    overlay = null;
    box.classList.remove("is-assembling");
  }

  function start() {
    box.appendChild(canvas);
    box.classList.add("is-drawn");
    var r = render();
    if (r && animate) assemble(r);

    // Later size changes redraw the finished wordmark; the animation never replays
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var before = lastKey;
        render();
        if (lastKey !== before) finish();
      });
    };
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(box);
    else window.addEventListener("resize", schedule);
  }

  start();
})();
