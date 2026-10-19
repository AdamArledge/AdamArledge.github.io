// Halftone wordmark: draws the hero name as a grid of round printer's dots.
// Inside the letters the dots swell until they run together, leaving small
// light holes; at the edges they shrink to specks. The letters are set in SF
// Pro Rounded where the system has it (Apple devices, through the ui-rounded
// font keyword), otherwise in Nunito.
//
// The heading's text stays in the page for screen readers and search engines;
// the canvas is decoration. Without JavaScript the name simply shows as type.
(function () {
  "use strict";

  var title = document.querySelector("[data-halftone]");
  var canvas = document.createElement("canvas");
  if (!title || !canvas.getContext) return;

  var FONT = '900 160px ui-rounded, "SF Pro Rounded", Nunito, sans-serif';
  var LINES = title.getAttribute("data-halftone").split("|"); // stacked lines on narrow screens
  var ONE_LINE_MIN = 560;   // px of width needed to set the name on one line
  var CELLS_PER_CAP = 14;   // dot rows across a capital letter's height (fewer = coarser, less legible)
  var DENSITY = 0.80;       // ink coverage inside the letters (1 = solid)
  var TEXTURE = 0.12;       // random variation in dot size inside the letters
  var EMBOLDEN = 0.01;      // extra weight around each letter, in em, so the strokes hold several dots

  canvas.className = "hero__halftone";
  canvas.setAttribute("aria-hidden", "true");

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

  // Draw the dots. The tone is interpolated between cell centres and compared
  // against a smooth dot pattern (peaks at the cell centres, troughs at the
  // corners): low tones give small dots, middle tones give dots that touch,
  // high tones leave only small holes. Edges are antialiased.
  function draw(grid, width, color) {
    var cols = grid.cols, rows = grid.rows, tone = grid.tone;
    var ratio = window.devicePixelRatio || 1;
    var W = Math.round(width * ratio);
    var s = W / cols; // device pixels per cell
    var H = Math.round(rows * s);
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
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
  }

  var grids = {};
  var lastKey = "";
  function render() {
    var oneLine = title.clientWidth >= ONE_LINE_MIN;
    canvas.classList.toggle("hero__halftone--stack", !oneLine);
    var width = canvas.clientWidth;
    var color = (getComputedStyle(title).color.match(/\d+/g) || [0, 0, 0]).map(Number);
    var key = oneLine + "/" + width + "/" + color + "/" + window.devicePixelRatio;
    if (!width || key === lastKey) return;
    lastKey = key;
    var lines = oneLine ? [LINES.join("")] : LINES;
    var id = lines.join("|");
    draw(grids[id] || (grids[id] = tones(lines)), width, color);
  }

  function start() {
    title.appendChild(canvas);
    title.classList.add("is-halftone");
    render();
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; render(); });
    };
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(title);
    else window.addEventListener("resize", schedule);
  }

  // Wait for the font, so the dots aren't drawn from a fallback face
  var text = LINES.join("");
  if (document.fonts && document.fonts.load) {
    document.fonts.load(FONT, text).then(start, start);
  } else {
    start();
  }
})();
