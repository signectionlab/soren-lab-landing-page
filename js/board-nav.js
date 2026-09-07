(function () {
  const toggle = document.getElementById("boardNavToggle");
  const overlay = document.getElementById("boardNavOverlay");
  const links = overlay ? overlay.querySelectorAll("a") : [];

  if (!toggle || !overlay) return;

  function closeNav() {
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openNav() {
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  toggle.addEventListener("click", function () {
    if (overlay.classList.contains("is-open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  links.forEach(function (link) {
    link.addEventListener("click", closeNav);
  });
})();
