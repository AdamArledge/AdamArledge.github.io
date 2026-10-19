// The dahlia in the Services section: a flower drawn in digits that blooms
// once, in about five and a half seconds, when the visitor scrolls it into
// view (never on its own during the page's opening), then rests in full bloom.
//
// It has to look printed on the page, not pasted on: the stills are
// transparent images, and the video (grey digits on white) is turned into the
// same thing frame by frame on a canvas, where darkness becomes ink and white
// becomes see-through. The video is only downloaded when it's needed. Without
// JavaScript, with "reduce motion" on, or if playback is blocked, the page
// shows the full-bloom still and nothing moves.
(function () {
  "use strict";

  var bloom = document.querySelector(".bloom");
  var still = bloom && bloom.querySelector(".bloom__still");
  if (!still || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var INK = [23, 23, 21]; // --ink; keep in step with scripts that made the stills
  var full = still.src;
  still.src = bloom.getAttribute("data-bud"); // start from the closed bud

  function showFull() {
    still.src = full;
    still.style.visibility = "";
  }

  function play() {
    var video = document.createElement("video");
    video.className = "bloom__source";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.src = bloom.getAttribute(video.canPlayType("video/webm; codecs=vp9") ? "data-webm" : "data-mp4");
    bloom.appendChild(video);

    var canvas = document.createElement("canvas");
    canvas.className = "bloom__frames";
    canvas.width = still.naturalWidth || 432;
    canvas.height = still.naturalHeight || 492;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var shown = false, done = false;

    // One frame: darkness becomes ink opacity (the same mapping as the stills)
    function draw() {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var a = (250 - d[i + 1]) * 255 / 235;
        d[i] = INK[0]; d[i + 1] = INK[1]; d[i + 2] = INK[2];
        d[i + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
      }
      ctx.putImageData(img, 0, 0);
      if (!shown) {
        shown = true;
        bloom.appendChild(canvas);
        still.style.visibility = "hidden";
      }
    }
    function loop() {
      if (done) return;
      if (video.readyState >= 2) draw();
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    }
    // At the end (or on any failure): back to the full-bloom still, and free the video
    function finish() {
      if (done) return;
      done = true;
      showFull();
      canvas.remove();
      video.removeAttribute("src");
      video.load();
      video.remove();
    }
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish);
    setTimeout(function () { if (!shown) finish(); }, 4000); // nothing drawn yet: give up
    var started = video.play();
    if (started && started.catch) started.catch(finish); // e.g. iOS Low Power Mode
    loop();
  }

  // Bloom once it's in view and the visitor has scrolled (on phones it can
  // already be in view at load, while the wordmark is forming)
  var visible = false, scrolled = false, started = false;
  function maybe() {
    if (started || !visible || !(scrolled || window.scrollY > 0)) return;
    started = true;
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    play();
  }
  function onScroll() {
    scrolled = true;
    maybe();
  }
  var observer = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    maybe();
  }, { threshold: 0.4 });
  observer.observe(bloom);
  window.addEventListener("scroll", onScroll, { passive: true });
})();
