(function () {
  const navToggle = document.getElementById("navToggle");
  const navOverlay = document.getElementById("navOverlay");
  const navLinks = document.querySelectorAll(".nav__link");

  if (!navToggle || !navOverlay) return;

  function closeMobileNav() {
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navOverlay.classList.remove("is-open");
    navOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openMobileNav() {
    navToggle.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    navOverlay.classList.add("is-open");
    navOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  navToggle.addEventListener("click", function () {
    if (navOverlay.classList.contains("is-open")) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  navLinks.forEach(function (link) {
    link.addEventListener("click", closeMobileNav);
  });
})();
