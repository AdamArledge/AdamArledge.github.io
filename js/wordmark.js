// Halftone wordmark: draws the hero name as a grid of round printer's dots.
// Inside the letters the dots swell until they run together, leaving small
// light holes; at the edges they shrink to specks. The letters are set in SF
// Pro Rounded where the system has it (Apple devices, through the ui-rounded
// font keyword), otherwise in Nunito.
//
// On page load the dots start scattered around the wordmark and are drawn
// into place in about a second (skipped under "reduce motion").
//
// The heading's text stays in the page for screen readers and search engines;
// the canvases are decoration. Without JavaScript the name shows as type.
(function () {
  "use strict";

  var title = document.querySelector("[data-halftone]");
  var box = title && title.querySelector(".hero__art"); // sized by CSS before this runs
  var canvas = document.createElement("canvas");
  if (!box || !canvas.getContext) return;

  var FONT = '900 160px ui-rounded, "SF Pro Rounded", Nunito, sans-serif';
  var LINES = title.getAttribute("data-halftone").split("|"); // stacked lines on narrow screens
  var CELLS_PER_CAP = 14;   // dot rows across a capital letter's height (fewer = coarser, less legible)
  var DENSITY = 0.80;       // ink coverage inside the letters (1 = solid)
  var TEXTURE = 0.12;       // random variation in dot size inside the letters
  var EMBOLDEN = 0.01;      // extra weight around each letter, in em, so the strokes hold several dots

  // Assembly animation: every piece finishes by STAGGER + MOVE_MAX ms
  var STAGGER = 180;        // latest start, in ms; pieces further right start a little later
  var MOVE_MIN = 620;       // shortest and longest travel time, in ms
  var MOVE_MAX = 820;
  var SCATTER = 1.1;        // how far pieces start from home, in capital-letter heights
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

  // Set the lines as solid type and measure how much ink falls in each cell
  // of the dot grid. Returns the grid's size and each cell's tone (0 to 1).
  function tones(lines) {
    var ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    ctx.font = FONT;
    var cell = ctx.measureText("H").actualBoundingBoxAscent / CELLS_PER_CAP;
    var pad = cell * 2 + EMBOLDEN * 160;
    var gap = cell * 2.5;
    var m = lines.map(function (t) { return ctx.measureText(t); });
    var w = 0, h = pad, baselines = [];
    m.forEach(function (lm, i) {
      w = Math.max(w, lm.actualBoundingBoxLeft + lm.actualBoundingBoxRight);
      h += (i ? gap : 0) + lm.actualBoundingBoxAscent;
      baselines.push(h);
      h += lm.actualBoundingBoxDescent;
    });
    var cols = Math.ceil((w + pad * 2) / cell);
    var rows = Math.ceil((h + pad) / cell);
    var W = Math.ceil(cols * cell), H = Math.ceil(rows * cell);
    // Centre the ink in the grid
    var ox = (cols * cell - w) / 2, oy = (rows * cell - h - pad) / 2;

    ctx.canvas.width = W;
    ctx.canvas.height = H;
    ctx.font = FONT;
    ctx.lineWidth = EMBOLDEN * 160 * 2;
    ctx.lineJoin = "round";
    lines.forEach(function (t, i) {
      ctx.fillText(t, ox + m[i].actualBoundingBoxLeft, oy + baselines[i]);
      ctx.strokeText(t, ox + m[i].actualBoundingBoxLeft, oy + baselines[i]);
    });
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
    return { cols: cols, rows: rows, tone: tone };
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

  // Size the canvas to the box CSS reserved, and draw the finished wordmark
  // centred in it. Returns what the animation needs, or null if unchanged.
  var grids = {};
  var lastKey = "";
  function render() {
    var lines = getComputedStyle(box).getPropertyValue("--wordmark-layout").trim() === "line" ? [LINES.join("")] : LINES;
    var ratio = window.devicePixelRatio || 1;
    var W = Math.round(box.clientWidth * ratio), H = Math.round(box.clientHeight * ratio);
    var color = (getComputedStyle(title).color.match(/\d+/g) || [0, 0, 0]).map(Number);
    var key = lines + "/" + W + "x" + H + "/" + color;
    if (!W || !H || key === lastKey) return null;
    lastKey = key;
    var id = lines.join("|");
    var grid = grids[id] || (grids[id] = tones(lines));
    var art = paint(grid, Math.min(W / grid.cols, H / grid.rows), color);
    var ox = Math.round((W - art.canvas.width) / 2), oy = Math.round((H - art.canvas.height) / 2);
    canvas.width = W;
    canvas.height = H;
    canvas.getContext("2d").drawImage(art.canvas, ox, oy);
    return { art: art, ox: ox, oy: oy, W: W, H: H, ratio: ratio };
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
    var MX = Math.round(cap * 0.8), MY = Math.round(cap * 0.35);
    var OW = r.W + 2 * MX, OH = r.H + 2 * MY;

    overlay = document.createElement("canvas");
    overlay.className = "hero__scatter";
    overlay.width = OW;
    overlay.height = OH;
    overlay.style.left = -MX / r.ratio + "px";
    overlay.style.top = -MY / r.ratio + "px";
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
        pieces.push({
          sx: x0, sy: y0, w: w, h: h, hx: hx, hy: hy, dx: dx, dy: dy,
          turn: (Math.random() - 0.5) * 1.2,      // the path curves in slightly, it doesn't spin
          from: 0.45 + Math.random() * 0.35,      // starts smaller, like a droplet
          delay: STAGGER * (0.5 * (hx / OW) + 0.5 * Math.random()),
          move: MOVE_MIN + Math.random() * (MOVE_MAX - MOVE_MIN)
        });
      }
    }

    function frame(t) {
      ctx.clearRect(0, 0, OW, OH);
      var moving = false;
      for (var k = 0; k < pieces.length; k++) {
        var p = pieces[k];
        var u = Math.min(1, Math.max(0, (t - p.delay) / p.move));
        if (u < 1) moving = true;
        var rest = Math.pow(1 - u, 4); // ease out: fast start, gentle landing
        var c = Math.cos(p.turn * rest), sn = Math.sin(p.turn * rest);
        var x = p.dx * rest, y = p.dy * rest;
        var size = 1 - (1 - p.from) * rest;
        var w = p.w * size, h = p.h * size;
        ctx.drawImage(art.canvas, p.sx, p.sy, p.w, p.h,
          p.hx + x * c - y * sn + (p.w - w) / 2, p.hy + x * sn + y * c + (p.h - h) / 2, w, h);
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
    title.classList.add("is-halftone");
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

  // Wait for the font, so the dots aren't drawn from a fallback face, but not
  // past the point where the CSS gives up and shows the plain type (3s)
  var text = LINES.join("");
  var started = false;
  var once = function () { if (!started) { started = true; start(); } };
  if (document.fonts && document.fonts.load) {
    document.fonts.load(FONT, text).then(once, once);
    setTimeout(once, 2500);
  } else {
    once();
  }
})();
