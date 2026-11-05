// Nav border once the page is scrolled
const nav = document.querySelector(".nav");
const updateNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
updateNav();
window.addEventListener("scroll", updateNav, { passive: true });

// Light/dark button: without a saved choice the page follows the system (prefers-color-scheme)
const themeButton = document.querySelector("[data-theme-toggle]");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () =>
  (document.documentElement.dataset.theme || (systemDark.matches ? "dark" : "light")) === "dark";
const labelTheme = () => {
  const dark = isDark();
  themeButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? "#111113" : "#ffffff"));
};
if (themeButton) {
  labelTheme();
  systemDark.addEventListener("change", labelTheme);
  themeButton.addEventListener("click", () => {
    const theme = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
    labelTheme();
  });
}

// Each task tab selects a pair of robot rollouts; videos pause when off screen.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const visibleVideos = new Set();
const players = [...document.querySelectorAll("[data-clip-player]")];
const playVisible = (video) => {
  if (visibleVideos.has(video) && !reducedMotion.matches) video.play().catch(() => {});
};
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        visibleVideos.add(target);
        playVisible(target);
      } else {
        visibleVideos.delete(target);
        target.pause();
      }
    });
  },
  { threshold: 0.4 },
);
players.forEach((player) => {
  const videos = [...player.querySelectorAll("video")];
  const tabs = [...player.querySelectorAll(".clip-tab")];
  const caption = player.querySelector("[data-clip-caption]");
  const strip = player.querySelector(".clip-tabs");
  const scrollButtons = [...player.querySelectorAll("[data-clip-scroll]")];
  const scrollBehavior = () => (reducedMotion.matches ? "auto" : "smooth");
  const updateScrollButtons = () => {
    const limit = Math.max(0, strip.scrollWidth - strip.clientWidth);
    scrollButtons.forEach((button) => {
      button.disabled =
        Number(button.dataset.clipScroll) < 0
          ? strip.scrollLeft <= 1
          : strip.scrollLeft >= limit - 1;
    });
  };
  scrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
      strip.scrollBy({
        left: Number(button.dataset.clipScroll) * strip.clientWidth * 0.8,
        behavior: scrollBehavior(),
      });
    });
  });
  strip.addEventListener("scroll", updateScrollButtons, { passive: true });
  new ResizeObserver(updateScrollButtons).observe(strip);
  updateScrollButtons();

  const revealTab = (tab) => {
    const bounds = strip.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    let offset = 0;
    if (item.left < bounds.left + 4) offset = item.left - bounds.left - 4;
    else if (item.right > bounds.right - 4) offset = item.right - bounds.right + 4;
    if (offset) strip.scrollBy({ left: offset, behavior: scrollBehavior() });
  };

  // Touch scrolling stays native; mouse dragging moves only the thumbnail strip.
  let dragStart = null;
  let dragged = false;
  strip.addEventListener("dragstart", (event) => event.preventDefault());
  strip.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragged = false;
    dragStart = { x: event.clientX, scroll: strip.scrollLeft, pointerId: event.pointerId };
  });
  strip.addEventListener("pointermove", (event) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;
    const distance = event.clientX - dragStart.x;
    if (!dragged && Math.abs(distance) < 5) return;
    dragged = true;
    strip.classList.add("is-dragging");
    strip.setPointerCapture(event.pointerId);
    strip.scrollLeft = dragStart.scroll - distance;
    event.preventDefault();
  });
  const endDrag = (event) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;
    dragStart = null;
    strip.classList.remove("is-dragging");
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  };
  strip.addEventListener("pointerup", endDrag);
  strip.addEventListener("pointercancel", (event) => {
    endDrag(event);
    dragged = false;
  });
  strip.addEventListener(
    "click",
    (event) => {
      if (dragged && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
      dragged = false;
    },
    true,
  );

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      revealTab(tab);
      if (tab.classList.contains("is-active")) return;
      videos.forEach((video) => video.pause());
      tabs.forEach((item) => {
        item.classList.toggle("is-active", item === tab);
        item.setAttribute("aria-pressed", String(item === tab));
      });
      caption.textContent = tab.dataset.caption;
      videos.forEach((video, slot) => {
        video.poster = slot === 0 ? tab.dataset.poster : tab.dataset.posterSecond;
        video.src = slot === 0 ? tab.dataset.src : tab.dataset.srcSecond;
        video.setAttribute("aria-label", `${tab.dataset.caption}: rollout ${slot + 1}`);
        video.load();
        playVisible(video);
      });
    });
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus({ preventScroll: true });
      tabs[next].click();
    });
  });
  videos.forEach((video) => observer.observe(video));
});
reducedMotion.addEventListener("change", () =>
  players.forEach((player) => {
    player.querySelectorAll("video").forEach((video) => {
      if (reducedMotion.matches) video.pause();
      else playVisible(video);
    });
  }),
);

// Copy BibTeX
const copyBtn = document.querySelector(".copy-btn");
if (copyBtn) {
  const label = copyBtn.querySelector("span");
  copyBtn.addEventListener("click", async () => {
    const code = document.getElementById("bibtex-code");
    try {
      await navigator.clipboard.writeText(code.textContent);
      label.textContent = "Copied";
    } catch {
      // No clipboard access (e.g. plain http): select the text instead
      window.getSelection().selectAllChildren(code);
      label.textContent = "Selected";
    }
    setTimeout(() => (label.textContent = "Copy"), 1800);
  });
}
