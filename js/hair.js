// Hero centerpiece: a bowed, featureless head in profile whose hair drifts on a
// curl-noise flow field, drawn as ASCII characters on a <canvas>.
//
// Each frame:
//   1. Move the strands. A strand is a chain of fixed-length segments; each
//      segment keeps the previous one's direction and is bent by the flow field,
//      more strongly toward the tip, so roots hold and ends float.
//   2. Sample every segment into the character grid, recording how much hair
//      passes through each cell and which way it runs.
//   3. Draw one character per cell: a line character that follows the hair's
//      direction (- | / \), or a density character (* # % @) where strands pile up.
// The motion is computed at full precision and only *displayed* as text, which
// is why the curves stay smooth.
(function () {
  "use strict";

  var canvas = document.querySelector(".hero__ascii");
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.closest(".hero");
  var ctx = canvas.getContext("2d");
  var atlas = document.createElement("canvas");
  var actx = atlas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Figure above the text (phones, any portrait screen) vs beside it; matches css/styles.css
  var STACKED = window.matchMedia("(max-width: 767px), (orientation: portrait)");

  // ---------- Look ----------
  var CHARS = ".:-|/\\~+*#%@";
  var C = {};
  for (var ci = 0; ci < CHARS.length; ci++) C[CHARS[ci]] = ci;
  var DENSE = [C["+"], C["*"], C["#"], C["%"], C["@"]];
  var LEVELS = 10;
  var PALETTES = [
    // neutral: sage brightening to off-white
    ["#3f3e39", "#55554e", "#6b6f64", "#808F7B", "#949d8a", "#A9AA9C", "#BDBAAD", "#CEC9BC", "#E5E1DC", "#F7F4EF"],
    // electric-blue locks
    ["#1b2456", "#222f85", "#293bb0", "#3049d8", "#3B5BFF", "#566fff", "#7086ff", "#8d9eff", "#adb9ff", "#d2d9ff"]
  ];
  var TILT = -0.55;   // head bowed forward (radians)
  var BODY_TILT = -0.12;
  var BEND = 1.0;     // how hard the flow field bends each segment
  var SPRING = 0.03;  // pull back toward the resting (outward) direction, so the shape stays radial
  var EASE = 0.1;     // per-frame easing toward the new shape: the "silkiness"
  var SAMPLE = 2.5;   // px between samples when laying a segment into the grid
  var MAX_TURN = 0.3;  // max bend per segment (radians): sets the tightest curl, so hair loops instead of crumpling

  // Head outline in head-height units, facing left; (0,0) is the center of the head.
  // Points below v = 0.55 form the neck and shoulders, run off the bottom of the
  // canvas, and get a gentler tilt so the shoulders drop instead of swinging up.
  var OUTLINE = [
    [0.02, -0.56], [0.25, -0.5], [0.42, -0.32], [0.5, -0.05], [0.44, 0.22], [0.3, 0.42],
    [0.3, 0.62], [0.42, 0.95], [0.85, 1.25], [1.5, 1.45], [2.4, 1.8], [2.4, 3.6],
    [-0.9, 3.6], [-0.75, 1.9], [-0.35, 1.2], [-0.16, 0.85],
    [-0.12, 0.62], [-0.24, 0.52], [-0.38, 0.44],
    [-0.45, 0.35], [-0.41, 0.3], [-0.48, 0.25], [-0.44, 0.19],
    [-0.6, 0.1], [-0.44, -0.04], [-0.46, -0.13], [-0.38, -0.36], [-0.2, -0.5]
  ];
  // Hairline arc (radians around the head center): forehead -> crown -> nape.
  // Long hair starts behind the forehead so the face stays clear.
  var SCALP = { x: 0.03, y: -0.06, from: 3.75, to: 7.25, longFrom: 4.35 };

  // ---------- Noise ----------
  // Improved Perlin noise (3D: x, y, time) with a fixed permutation so the
  // figure looks the same on every visit.
  var perm = new Uint8Array(512);
  var rand = mulberry32(20261018);
  (function () {
    var p = [], i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function grad(h, x, y, z) {
    h &= 15;
    var u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise3(x, y, z) {
    var fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    var X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    var u = fade(x), v = fade(y), w = fade(z);
    var A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    var B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
           lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  // Curl of the noise field: a swirling flow with no sources or sinks, like an
  // incompressible fluid. Strands carried by it loop around each other instead
  // of clumping, which gives the slow underwater curls.
  var EPS = 0.01;
  function curl(x, y, t, out) {
    out.x = (noise3(x, y + EPS, t) - noise3(x, y - EPS, t)) / (2 * EPS);
    out.y = -(noise3(x + EPS, y, t) - noise3(x - EPS, y, t)) / (2 * EPS);
  }

  // ---------- State ----------
  var w, h, dpr, cols, rows, cw, ch, fontSize, gw, gh;
  var cx, cy, H, cosA, sinA, cosB, sinB;
  var silhouette, mask, strands;
  var amount, dirC, dirS, blueAmt; // per-cell accumulators
  var running = false, inView = true, last = 0, frameMs = 1000 / 30;
  var flow = { x: 0, y: 0 };

  function toScreen(u, v) {
    return [cx + H * (u * cosA - v * sinA), cy + H * (u * sinA + v * cosA)];
  }
  function outlineToScreen(p) {
    if (p[1] <= 0.55) return toScreen(p[0], p[1]);
    // Body: pivot at the neck so it joins the head, but tilt less
    var neck = toScreen(0, 0.55), u = p[0], v = p[1] - 0.55;
    return [neck[0] + H * (u * cosB - v * sinB), neck[1] + H * (u * sinB + v * cosB)];
  }

  // Closed curve through the midpoints of the outline, using each point as a control point
  function smoothPath(pts) {
    var p = new Path2D(), n = pts.length, i, c, nx;
    p.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (i = 1; i <= n; i++) {
      c = pts[i % n]; nx = pts[(i + 1) % n];
      p.quadraticCurveTo(c[0], c[1], (c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2);
    }
    p.closePath();
    return p;
  }

  function layout() {
    var r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    var mobile = w < 768, stacked = STACKED.matches;
    frameMs = 1000 / (mobile ? 20 : 30); // the motion is slow, so phones can save battery
    fontSize = mobile ? 10 : 12;
    ctx.font = fontSize + "px 'Space Mono', monospace";
    cw = ctx.measureText("M").width;
    ch = Math.round(fontSize * 1.25);
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / ch);
    amount = new Float32Array(cols * rows);
    dirC = new Float32Array(cols * rows);
    dirS = new Float32Array(cols * rows);
    blueAmt = new Float32Array(cols * rows);

    // Figure: right of the title on wide screens, top half when stacked (text sits below)
    H = stacked ? Math.min(w * 0.27, h * 0.16) : Math.min(h * 0.24, w * 0.15);
    cx = stacked ? w * 0.6 : w * 0.74;
    cy = stacked ? h * 0.32 : h * 0.63;
    cosA = Math.cos(TILT); sinA = Math.sin(TILT);
    cosB = Math.cos(BODY_TILT); sinB = Math.sin(BODY_TILT);

    silhouette = smoothPath(OUTLINE.map(outlineToScreen));
    buildMask();
    buildStrands(mobile);
    buildAtlas();

    // Let the strands settle into the flow field before the first paint
    var t = performance.now() / 1000;
    step(t, 1); // with no easing one pass computes the settled shape
    render(t);
  }

  // Which text cells are inside the head (1), on its lit edge (2) or its shaded edge (3)
  function buildMask() {
    var m = document.createElement("canvas");
    m.width = cols; m.height = rows;
    var mctx = m.getContext("2d");
    mctx.setTransform(cols / w, 0, 0, rows / h, 0, 0);
    mctx.fill(silhouette);
    var a = mctx.getImageData(0, 0, cols, rows).data;
    var inside = new Uint8Array(cols * rows), x, y, i;
    for (i = 0; i < inside.length; i++) inside[i] = a[i * 4 + 3] > 127 ? 1 : 0;
    mask = new Uint8Array(cols * rows);
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        i = y * cols + x;
        if (!inside[i]) continue;
        var left = x > 0 && !inside[i - 1];
        var right = x < cols - 1 && !inside[i + 1];
        var up = y > 0 && !inside[i - cols];
        var down = y < rows - 1 && !inside[i + cols];
        // The face points left, so light catches the left edges (forehead, nose, chin, throat)
        mask[i] = left ? 2 : (right || up || down) ? 3 : 1;
      }
    }
  }

  // One strand. Strands in the same lock share `phase`, so they read the same
  // part of the flow field and travel together.
  function addStrand(angle, rootR, n, segK, phase, blue, fuzz) {
    var root = toScreen(SCALP.x + Math.cos(angle) * rootR, SCALP.y + Math.sin(angle) * rootR);
    // Outward from the scalp, biased up and back, away from the face
    var nx = Math.cos(angle) * cosA - Math.sin(angle) * sinA;
    var ny = Math.cos(angle) * sinA + Math.sin(angle) * cosA;
    var bx = nx * 0.75 + 0.5, by = ny * 0.75 - 0.35, d = Math.hypot(bx, by);
    var s = {
      rx: root[0], ry: root[1], bx: bx / d, by: by / d, n: n, len: H * segK,
      xs: new Float32Array(n + 1), ys: new Float32Array(n + 1), ang: new Float32Array(n + 1), bright: new Float32Array(n + 1),
      blue: blue, gain: 0.8 + rand() * 0.4, phase: phase
    };
    for (var i = 0; i <= n; i++) {
      s.xs[i] = s.rx + s.bx * s.len * i;
      s.ys[i] = s.ry + s.by * s.len * i;
      s.ang[i] = Math.atan2(s.by, s.bx);
      // Dim at the root, brightening through the length, softening at the very tip
      var f = i / n, b;
      if (fuzz) b = 0.3;
      else {
        // Like the photo: dark at the roots (they merge into the head), light toward the tips
        b = Math.max(0, Math.min(1, (f - 0.12) / 0.6));
        if (f > 0.88) b *= 1 - (f - 0.88) / 0.12 * 0.6;
      }
      s.bright[i] = b;
    }
    strands.push(s);
  }

  function buildStrands(mobile) {
    rand = mulberry32(7);
    strands = [];
    var locks = mobile ? 13 : 19, fuzz = mobile ? 18 : 30, i, j, u, a, n, phase, blue;
    for (i = 0; i < locks; i++) {
      u = (rand() + rand()) / 2; // triangular: more locks at the crown than at the edges
      a = SCALP.longFrom + (SCALP.to - SCALP.longFrom) * u;
      n = 22 + Math.floor(rand() * 22);
      phase = rand() * 20;
      blue = rand() < 0.15;
      // Three strands per lock, roots side by side, slightly different lengths
      for (j = 0; j < 3; j++) {
        addStrand(a + (j - 1) * 0.14, 0.44, n - Math.floor(rand() * 8), 0.05, phase + j * 0.08, blue, false);
      }
    }
    // Short fuzz all along the hairline gives the crown its dense core
    for (i = 0; i < fuzz; i++) {
      u = (rand() + rand()) / 2;
      addStrand(SCALP.from + (SCALP.to - SCALP.from) * u, 0.4, 4 + Math.floor(rand() * 5), 0.055, rand() * 20, false, true);
    }
  }

  // Pre-render every character at every brightness in every palette once;
  // drawing sprites is much cheaper than thousands of fillText calls per frame.
  function buildAtlas() {
    gw = Math.ceil(cw * dpr); gh = Math.ceil(ch * dpr);
    atlas.width = gw * CHARS.length;
    atlas.height = gh * LEVELS * PALETTES.length;
    actx.font = fontSize * dpr + "px 'Space Mono', monospace";
    actx.textAlign = "center";
    actx.textBaseline = "middle";
    for (var p = 0; p < PALETTES.length; p++) {
      for (var l = 0; l < LEVELS; l++) {
        actx.fillStyle = PALETTES[p][l];
        for (var c = 0; c < CHARS.length; c++) {
          actx.fillText(CHARS[c], (c + 0.5) * gw, (p * LEVELS + l + 0.5) * gh);
        }
      }
    }
  }

  function step(time, ease) {
    var tt = time * 0.06, fs = 1.2 / H;
    for (var k = 0; k < strands.length; k++) {
      var s = strands[k];
      // Slow sway of the whole strand around its resting direction
      var sw = 0.2 * Math.sin(time * 0.3 + s.phase), c = Math.cos(sw), sn = Math.sin(sw);
      var bx = s.bx * c - s.by * sn, by = s.bx * sn + s.by * c;
      // Walk the *target* shape (depends only on time) and ease each segment's
      // angle toward it, then rebuild positions from the angles. Easing angles
      // rather than positions keeps lengths exact and can't build up lag.
      var base = Math.atan2(by, bx), cur = base, px = s.rx, py = s.ry, ax = s.rx, ay = s.ry;
      for (var i = 1; i <= s.n; i++) {
        curl(px * fs + s.phase, py * fs + s.phase * 0.7, tt, flow);
        var dx = Math.cos(cur), dy = Math.sin(cur);
        // The flow only bends the strand sideways (its component across the strand),
        // more toward the tip; a spring pulls it back toward its outward direction.
        // The deviation is wrapped to ±π, so a strand curled past halfway finishes
        // the loop instead of snapping back.
        var dev = cur - base;
        dev -= Math.round(dev / (2 * Math.PI)) * 2 * Math.PI;
        var f = i / s.n;
        var turn = BEND * f * Math.sqrt(f) * s.gain * (dx * flow.y - dy * flow.x) - SPRING * dev;
        if (turn > MAX_TURN) turn = MAX_TURN;
        else if (turn < -MAX_TURN) turn = -MAX_TURN;
        cur += turn;
        px += Math.cos(cur) * s.len;
        py += Math.sin(cur) * s.len;
        var da = cur - s.ang[i];
        da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
        s.ang[i] += da * ease;
        ax = s.xs[i] = ax + Math.cos(s.ang[i]) * s.len;
        ay = s.ys[i] = ay + Math.sin(s.ang[i]) * s.len;
      }
    }
  }

  // Lay every segment into the grid. Direction is stored as (cos 2θ, sin 2θ) so a
  // strand heading left and one heading right both count as "horizontal" instead
  // of cancelling each other out.
  function accumulate() {
    amount.fill(0); dirC.fill(0); dirS.fill(0); blueAmt.fill(0);
    for (var k = 0; k < strands.length; k++) {
      var s = strands[k];
      for (var i = 1; i <= s.n; i++) {
        var x0 = s.xs[i - 1], y0 = s.ys[i - 1], ex = s.xs[i] - x0, ey = s.ys[i] - y0;
        var len = Math.hypot(ex, ey) || 1, ux = ex / len, uy = ey / len;
        var c2 = ux * ux - uy * uy, s2 = 2 * ux * uy, b = s.bright[i];
        var steps = Math.max(1, Math.round(len / SAMPLE));
        for (var j = 0; j < steps; j++) {
          var t = (j + 0.5) / steps;
          var gx = Math.floor((x0 + ex * t) / cw), gy = Math.floor((y0 + ey * t) / ch);
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          var idx = gy * cols + gx;
          amount[idx] += b;
          dirC[idx] += c2 * b;
          dirS[idx] += s2 * b;
          if (s.blue) blueAmt[idx] += b;
        }
      }
    }
  }

  function render(time) {
    accumulate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Silhouette as a smooth dark void, plus the dark mass of hair at the crown
    // (the root third of each long strand, stroked thick)
    ctx.fillStyle = ctx.strokeStyle = "rgba(14, 13, 12, 0.94)";
    ctx.fill(silhouette);
    var core = new Path2D();
    for (var k = 0; k < strands.length; k++) {
      var s = strands[k], end = Math.ceil(s.n * 0.22);
      if (s.n < 10) continue;
      core.moveTo(s.rx, s.ry);
      for (var i = 1; i <= end; i++) core.lineTo(s.xs[i], s.ys[i]);
    }
    ctx.lineWidth = H * 0.06;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke(core);

    var dust = time * 0.05, idx = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++, idx++) {
        var a = amount[idx];
        if (a > 0.25) {
          var v = Math.min(1, a / 3.5);
          var level = Math.min(LEVELS - 1, Math.floor(Math.pow(v, 0.7) * LEVELS));
          var pal = blueAmt[idx] > a * 0.5 ? 1 : 0;
          var coherence = Math.hypot(dirC[idx], dirS[idx]) / a;
          var c;
          if (a > 9 || coherence < 0.4) {
            // Strands piling up or crossing: density character
            c = DENSE[Math.min(DENSE.length - 1, Math.floor(Math.min(1, a / 16) * DENSE.length))];
          } else {
            // A single strand or lock: follow its direction. θ = atan2(sin2θ, cos2θ) / 2,
            // in screen space where +y is down, so a positive angle runs down-right: "\"
            var ang = Math.atan2(dirS[idx], dirC[idx]) / 2;
            var aa = Math.abs(ang);
            c = aa < 0.39 ? C["-"] : aa > 1.18 ? C["|"] : ang > 0 ? C["\\"] : C["/"];
          }
          glyph(c, pal, level, x, y);
          continue;
        }
        var m = mask[idx];
        if (m === 1) continue;
        if (m === 2) { glyph(C[":"], 0, 7, x, y); continue; }
        if (m === 3) { glyph(C["."], 0, 3, x, y); continue; }
        // Faint drifting dust everywhere else, so the head reads as an absence
        var n = noise3(x * 0.09, y * 0.18, dust);
        if (n > 0.38) glyph(n > 0.5 ? C[":"] : C["."], 0, 0, x, y);
      }
    }
  }

  function glyph(c, p, l, x, y) {
    ctx.drawImage(atlas, c * gw, (p * LEVELS + l) * gh, gw, gh, x * cw, y * ch, gw / dpr, gh / dpr);
  }

  // ---------- Loop ----------
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < frameMs) return;
    last = now;
    step(now / 1000, EASE);
    render(now / 1000);
  }
  function update() {
    var go = inView && !document.hidden && !reduceMotion.matches;
    if (go && !running) { running = true; requestAnimationFrame(frame); }
    if (!go) running = false;
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { inView = e[0].isIntersecting; update(); }).observe(hero);
  }
  document.addEventListener("visibilitychange", update);
  // With reduced motion the figure stays as a still frame
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", update);
  else reduceMotion.addListener(update);

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  }
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(hero);
  else window.addEventListener("resize", onResize);

  layout();
  update();
  // Space Mono changes the character width once it loads
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
