(function () {
  const videos = document.querySelectorAll(".bg-media__video");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileQuery = window.matchMedia("(max-width: 768px)");

  function shouldPlayVideo(video) {
    if (prefersReducedMotion) return false;
    if (mobileQuery.matches && video.dataset.video !== "hero") return false;
    return true;
  }

  function markFallback(video) {
    video.classList.add("is-fallback");
    video.classList.remove("is-ready");
    video.pause();
  }

  function markReady(video) {
    video.classList.add("is-ready");
  }

  function tryPlay(video) {
    video.muted = true;
    video.defaultMuted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(function () {
          markReady(video);
        })
        .catch(function () {
          markFallback(video);
        });
    }
  }

  function initVideo(video) {
    if (!shouldPlayVideo(video)) {
      markFallback(video);
      return;
    }

    video.classList.remove("is-fallback");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");

    video.addEventListener("playing", function () {
      markReady(video);
    });

    video.addEventListener("error", function () {
      markFallback(video);
    }, { once: true });

    if (video.dataset.video === "hero" || video.hasAttribute("autoplay")) {
      if (video.readyState >= 2) {
        tryPlay(video);
      } else {
        video.addEventListener("canplay", function () {
          tryPlay(video);
        }, { once: true });
      }
      return;
    }

    video.addEventListener("canplay", function () {
      tryPlay(video);
    }, { once: true });

    if (video.readyState < 2) {
      video.load();
    } else {
      tryPlay(video);
    }
  }

  videos.forEach(initVideo);

  document.addEventListener("visibilitychange", function () {
    videos.forEach(function (video) {
      if (video.classList.contains("is-fallback")) return;

      if (document.hidden) {
        video.pause();
      } else if (shouldPlayVideo(video)) {
        video.play().catch(function () {});
      }
    });
  });

  mobileQuery.addEventListener("change", function () {
    videos.forEach(initVideo);
  });
})();
