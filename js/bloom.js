// The dahlia in the Services section: a flower drawn in digits that blooms
// once, in about five and a half seconds, when the visitor scrolls it into
// view (never on its own during the page's opening), then rests in full bloom. The video is only downloaded at that point. Without
// JavaScript, or with "reduce motion" on, the page shows the full-bloom
// still (the video's poster) and nothing moves.
(function () {
  "use strict";

  var video = document.querySelector(".bloom__video");
  if (!video || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Until it plays, show the closed bud, so the bloom starts where the still left off
  var full = video.poster;
  video.poster = video.getAttribute("data-start-poster");

  // Bloom once it's in view and the visitor has scrolled (on phones it can
  // already be in view at load, while the wordmark is forming)
  var visible = false, scrolled = false, started = false;
  function maybe() {
    if (started || !visible || !(scrolled || window.scrollY > 0)) return;
    started = true;
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    Array.prototype.forEach.call(video.querySelectorAll("source[data-src]"), function (source) {
      source.src = source.getAttribute("data-src");
    });
    video.load();
    var play = video.play();
    // If the browser won't play it (e.g. iOS Low Power Mode), show the full bloom
    if (play && play.catch) play.catch(function () { video.poster = full; });
  }
  function onScroll() {
    scrolled = true;
    maybe();
  }
  var observer = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    maybe();
  }, { threshold: 0.4 });
  observer.observe(video);
  window.addEventListener("scroll", onScroll, { passive: true });
})();
