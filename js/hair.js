// Hero background: a sweep of long, wavy hair flowing across the hero behind the
// brand name, drawn as ASCII characters on a <canvas>.
//
// Each strand runs from off-screen left to the right edge along a band centered
// on the title. The band is narrow at the roots and fans out toward the tips.
// Two travelling sine waves roll along every strand from root to tip; strands in
// the same lock share their wave phase, so locks move together and cross over
// neighbouring locks. A slow noise term varies each lock's amplitude so the
// motion never looks mechanical.
//
// Rendering: every strand is sampled into the character grid, recording how much
// hair passes through each cell and which way it runs. Each cell then gets a
// line character that follows the hair (- / \ |), or a density character
// (* # % @) where locks cross.
(function () {
  "use strict";

  var canvas = document.querySelector(".hero__ascii");
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.closest(".hero");
  var title = hero.querySelector(".hero__title");
  var eyebrow = hero.querySelector(".hero__eyebrow");
  var tagline = hero.querySelector(".hero__tagline");
  var ctx = canvas.getContext("2d");
  var atlas = document.createElement("canvas");
  var actx = atlas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- Look ----------
  var CHARS = ".:-|/\\+*#%@";
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
  var SAMPLE = 2.5;   // px between samples when laying a strand into the grid
  var STEP = 6;       // px between points along a strand

  // ---------- Noise (slow amplitude drift + background dust) ----------
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
  function smoothstep(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  // ---------- State ----------
  var w, h, dpr, cols, rows, cw, ch, fontSize, gw, gh;
  var band;   // where the sweep runs: centered on the title
  var behind; // text block (eyebrow, title, tagline) in grid cells; hair there is dimmed so it reads as depth
  var strands, amount, dirC, dirS, blueAmt;
  var dust, frameNo = 0; // background dust: 0 none, 1 ".", 2 ":"; drifts slowly, so refreshed every 5th frame
  var running = false, inView = true, last = 0, frameMs = 1000 / 30;

  function layout() {
    var r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    var mobile = w < 768;
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
    dust = new Uint8Array(cols * rows);
    frameNo = 0;

    // The sweep passes behind the brand name, rising gently to the right
    var t = title.getBoundingClientRect();
    band = {
      x0: -0.12 * w, x1: w * 1.04,                  // roots off-screen left, tips at the right edge
      cx: t.left - r.left + t.width * 0.45,
      cy: t.top - r.top + t.height * 0.5,
      slope: mobile ? -0.12 : -0.07,                // rise per px (negative = up to the right)
      root: h * (mobile ? 0.14 : 0.16),             // band half-width at the roots
      tip: h * (mobile ? 0.24 : 0.26),              // ...and at the tips
      amp: h * (mobile ? 0.06 : 0.085)              // main wave height
    };
    var top = (eyebrow || title).getBoundingClientRect(), tag = (tagline || title).getBoundingClientRect();
    behind = {
      x0: Math.floor((t.left - r.left) / cw), x1: Math.ceil((Math.max(t.right, tag.right) - r.left) / cw),
      y0: Math.floor((top.top - r.top) / ch), y1: Math.ceil((tag.bottom - r.top) / ch)
    };

    buildStrands(mobile);
    buildAtlas();
    render(performance.now() / 1000);
  }

  function buildStrands(mobile) {
    rand = mulberry32(7);
    strands = [];
    var locks = mobile ? 11 : 15, i, j;
    for (i = 0; i < locks; i++) {
      // Each lock: a lane in the band, its own wave phase and speed, 3-4 strands
      var lane = (i / (locks - 1)) * 2 - 1 + (rand() - 0.5) * 0.15;
      var lock = {
        phase: rand() * Math.PI * 2, phase2: rand() * Math.PI * 2,
        speed: 0.45 + rand() * 0.3, gain: 0.7 + rand() * 0.5, seed: rand() * 50,
        blue: rand() < 0.15, bright: 0.65 + rand() * 0.35
      };
      var n = 3 + Math.floor(rand() * 2);
      for (j = 0; j < n; j++) {
        strands.push({
          lock: lock,
          lane: lane + (j - (n - 1) / 2) * 0.045, // strands in a lock sit side by side
          drift: (rand() - 0.5) * 0.4,            // tiny phase difference so they shimmer apart
          end: 0.86 + rand() * 0.14               // tips end at slightly different lengths
        });
      }
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

  // y of a strand at horizontal position x (s = 0 at the roots, 1 at the right edge)
  function strandY(st, x, s, t, ampMod) {
    var L = st.lock, b = band;
    var k1 = (Math.PI * 2) / (w * 0.45), k2 = (Math.PI * 2) / (w * 0.17);
    // Roots barely move, tips swing most; "- t * speed" makes the waves travel toward the tips
    var env = 0.35 + 0.65 * s;
    var wave = Math.sin(k1 * x - t * L.speed + L.phase + st.drift) +
               0.4 * Math.sin(k2 * x - t * L.speed * 1.7 + L.phase2 + st.drift);
    var spread = lerp(b.root, b.tip, Math.pow(s, 1.4)) * st.lane;
    return b.cy + (x - b.cx) * b.slope + spread + wave * b.amp * env * L.gain * ampMod;
  }

  // Lay every strand into the grid. Direction is stored as (cos 2θ, sin 2θ) so a
  // strand heading left and one heading right both count as "horizontal" instead
  // of cancelling each other out.
  function accumulate(t) {
    amount.fill(0); dirC.fill(0); dirS.fill(0); blueAmt.fill(0);
    var span = band.x1 - band.x0;
    for (var k = 0; k < strands.length; k++) {
      var st = strands[k], L = st.lock;
      var ampMod = 0.75 + 0.5 * noise3(L.seed, t * 0.05, 0.5);
      var xEnd = band.x0 + span * st.end;
      var px = band.x0, py = strandY(st, px, 0, t, ampMod);
      for (var x = band.x0 + STEP; x <= xEnd; x += STEP) {
        var s = (x - band.x0) / span;
        var y = strandY(st, x, s, t, ampMod);
        // Dim where the roots enter, full through the middle, fading at the tips
        var b = L.bright * smoothstep(0.05, 0.3, s) * (1 - 0.7 * smoothstep(st.end - 0.18, st.end, s));
        var ex = x - px, ey = y - py, len = Math.hypot(ex, ey), ux = ex / len, uy = ey / len;
        var c2 = ux * ux - uy * uy, s2 = 2 * ux * uy;
        var steps = Math.max(1, Math.round(len / SAMPLE));
        for (var j = 0; j < steps; j++) {
          var f = (j + 0.5) / steps;
          var gx = Math.floor((px + ex * f) / cw), gy = Math.floor((py + ey * f) / ch);
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          var idx = gy * cols + gx;
          amount[idx] += b;
          dirC[idx] += c2 * b;
          dirS[idx] += s2 * b;
          if (L.blue) blueAmt[idx] += b;
        }
        px = x; py = y;
      }
    }
  }

  function render(t) {
    accumulate(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (frameNo++ % 5 === 0) {
      var dz = t * 0.05, di = 0;
      for (var dy = 0; dy < rows; dy++) {
        for (var dx = 0; dx < cols; dx++, di++) {
          var n = noise3(dx * 0.09, dy * 0.18, dz);
          dust[di] = n > 0.52 ? 2 : n > 0.4 ? 1 : 0;
        }
      }
    }
    var idx = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++, idx++) {
        var a = amount[idx];
        if (a > 0.3) {
          var v = Math.min(1, a / 3.2);
          if (x >= behind.x0 && x < behind.x1 && y >= behind.y0 && y < behind.y1) { v *= 0.5; a = Math.min(a, 7); }
          var level = Math.min(LEVELS - 1, Math.floor(Math.pow(v, 0.7) * LEVELS));
          var pal = blueAmt[idx] > a * 0.5 ? 1 : 0;
          var coherence = Math.hypot(dirC[idx], dirS[idx]) / a;
          var c;
          if (a > 7.5 || coherence < 0.35) {
            // Locks crossing: density character
            c = DENSE[Math.min(DENSE.length - 1, Math.floor(Math.min(1, a / 14) * DENSE.length))];
          } else {
            // Follow the hair. θ = atan2(sin2θ, cos2θ) / 2, in screen space where +y
            // is down, so a positive angle runs down-right: "\"
            var ang = Math.atan2(dirS[idx], dirC[idx]) / 2, aa = Math.abs(ang);
            c = aa < 0.3 ? C["-"] : aa > 1.18 ? C["|"] : ang > 0 ? C["\\"] : C["/"];
          }
          glyph(c, pal, level, x, y);
          continue;
        }
        // Faint drifting dust everywhere else
        if (dust[idx]) glyph(dust[idx] === 2 ? C[":"] : C["."], 0, 0, x, y);
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
  // With reduced motion the sweep stays as a still frame
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
  // Space Mono changes the character width, and the title's size, once fonts load
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
