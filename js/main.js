(function () {
  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  const navOverlay = document.getElementById("navOverlay");
  const navLinks = document.querySelectorAll(".nav__link");
  const sections = document.querySelectorAll("section[id]");
  const productModal = document.getElementById("productModal");

  const products = {
    deep01: {
      code: "DEEP 01",
      title: "딥 하이드레이션 세럼",
      type: "Deep Hydration Serum",
      message: "수분, 정교하게.",
      desc: "피부 깊숙한 수분감을 위한 고농축 수분 세럼입니다. 층층이 스며드는 수분감과 정교한 피부 텍스처를 완성합니다.",
      image: "assets/images/product_serum_02.jpeg",
      ingredients: [
        "멀티 분자 히알루론산",
        "판테놀",
        "베타글루칸",
      ],
    },
    barrier02: {
      code: "BARRIER 02",
      title: "배리어 크림",
      type: "Barrier Cream",
      message: "균형이 장벽을 만듭니다.",
      desc: "피부 장벽과 수분 밸런스를 위한 고밀도 크림입니다. 건조하고 예민해진 피부에 편안한 보호막을 제공합니다.",
      image: "assets/images/product_hydra_02.jpeg",
      ingredients: [
        "세라마이드 컴플렉스",
        "스쿠알란",
        "콜레스테롤",
        "지방산 컴플렉스",
      ],
    },
    calm03: {
      code: "CALM 03",
      title: "캄 에센스",
      type: "Calm Essence",
      message: "편안함, 곧 케어입니다.",
      desc: "민감해진 피부의 편안한 컨디션을 위한 에센스입니다. 자극받은 피부를 부드럽게 진정시킵니다.",
      image: "assets/images/product_studio.jpeg",
      ingredients: ["센텔라", "마데카소사이드", "알란토인"],
    },
  };

  function updateHeader() {
    const scrollY = window.scrollY;
    header.classList.toggle("header--scrolled", scrollY > 80);
    header.classList.toggle("header--dark", scrollY <= 80);
  }

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
    link.addEventListener("click", function () {
      closeMobileNav();
    });
  });

  function updateActiveNav() {
    let current = "";
    sections.forEach(function (section) {
      const top = section.offsetTop - 120;
      if (window.scrollY >= top) {
        current = section.id;
      }
    });

    navLinks.forEach(function (link) {
      const section = link.dataset.section;
      link.classList.toggle("is-active", section === current);
    });
  }

  window.addEventListener("scroll", function () {
    updateHeader();
    updateActiveNav();
  });

  updateHeader();
  updateActiveNav();

  function openModal(productId) {
    const product = products[productId];
    if (!product) return;

    document.getElementById("modalImage").src = product.image;
    document.getElementById("modalImage").alt = product.title;
    document.getElementById("modalCode").textContent = product.code;
    document.getElementById("modalTitle").textContent = product.title;
    document.getElementById("modalType").textContent = product.type;
    document.getElementById("modalMessage").textContent = '"' + product.message + '"';
    document.getElementById("modalDesc").textContent = product.desc;

    const ingredientsEl = document.getElementById("modalIngredients");
    ingredientsEl.innerHTML = "";
    product.ingredients.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item;
      ingredientsEl.appendChild(li);
    });

    productModal.classList.add("is-open");
    productModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    productModal.classList.remove("is-open");
    productModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".product-card").forEach(function (card) {
    card.addEventListener("click", function () {
      openModal(card.dataset.product);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(card.dataset.product);
      }
    });
  });

  productModal.querySelectorAll("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && productModal.classList.contains("is-open")) {
      closeModal();
    }
  });
})();
