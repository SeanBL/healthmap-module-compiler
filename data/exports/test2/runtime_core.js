// runtime_core.js

// -------------------------
// Theme Presets
// -------------------------

const MODULE_THEMES = [
  {
    name: "blue",
    bg: "#eef4ff",
    bgHover: "#e2edff",
    text: "#173b67",
    border: "#c7d7f5",
    activeBg: "#2f6fed"
  },
  {
    name: "green",
    bg: "#eef8ec",
    bgHover: "#e4f3e0",
    text: "#24512c",
    border: "#cfe6cc",
    activeBg: "#4b9b52"
  },
  {
    name: "teal",
    bg: "#eaf8f6",
    bgHover: "#dcf1ee",
    text: "#14534c",
    border: "#c7e8e2",
    activeBg: "#1f9d8b"
  },
  {
    name: "purple",
    bg: "#f3efff",
    bgHover: "#ebe4ff",
    text: "#4b3472",
    border: "#d8cdf5",
    activeBg: "#7b57d1"
  },
  {
    name: "orange",
    bg: "#fff3e8",
    bgHover: "#ffe8d6",
    text: "#7a4317",
    border: "#f5d2b8",
    activeBg: "#e6842a"
  }
];

function getThemeForModule(moduleId) {
  const themes = MODULE_THEMES;

  const numericId = Number(moduleId);

  if (Number.isFinite(numericId)) {
    return themes[Math.abs(numericId) % themes.length];
  }

  return themes[0];
}

function applyModuleTheme(theme) {
  const root = document.documentElement;

  root.style.setProperty("--engage-btn-bg", theme.bg);
  root.style.setProperty("--engage-btn-bg-hover", theme.bgHover);
  root.style.setProperty("--engage-btn-text", theme.text);
  root.style.setProperty("--engage-btn-border", theme.border);
  root.style.setProperty("--engage-btn-active-bg", theme.activeBg);
}

// -------------------------
// Load Module JSON
// -------------------------

async function loadModule() {
  try {
    const response = await fetch("module.json");
    const data = await response.json();
    console.log("MODULE JSON:", data);
    RuntimeState.moduleId = data.module_id || data.moduleId || null;
    RuntimeState.title = data.module_title || "HealthMAP Module";
    RuntimeState.slides = data.slides || [];
    RuntimeState.resources = data.resources || [];

    // -------------------------
    // Apply Theme (Phase 3)
    // -------------------------
    const theme = getThemeForModule(RuntimeState.moduleId);
    applyModuleTheme(theme);

    buildFinalQuizIndex();

    document.getElementById("module-title").textContent = RuntimeState.title;

    // Load saved progress AFTER moduleId is known
    if (RuntimeState.moduleId) loadProgress();

  } catch (err) {
    console.error("Failed to load module:", err);
  }
}

// -------------------------
// Menu Section Builder
// -------------------------

function getMenuSections() {
  const sections = [];
  let visibleIndex = 0;

  let inlineQuizCount = 0;

  RuntimeState.slides.forEach((slide, slideIndex) => {

    const isQuiz =
      typeof slide.type === "string" &&
      slide.type.toLowerCase() === "quiz";

    if (isQuiz) {
      const scope = (slide.quiz_scope || "inline").toLowerCase();

      const prevSlide = RuntimeState.slides[slideIndex - 1];

      const prevIsSameQuiz =
        prevSlide &&
        prevSlide.type === "quiz" &&
        (prevSlide.quiz_scope || "inline").toLowerCase() === scope;

      // 🚫 Skip if this is NOT the first in a group
      if (prevIsSameQuiz) return;

      let displayTitle = "";

      if (scope === "inline") {
        inlineQuizCount++;
        displayTitle = `Inline Quiz ${inlineQuizCount}`;
      } else if (scope === "application") {
        displayTitle = "Application Quiz";
      } else if (scope === "final") {
        displayTitle = "Final Quiz";
      } else {
        displayTitle = "Quiz";
      }

      sections.push({
        slideIndex,
        label: `1.${visibleIndex}`,
        title: displayTitle
      });

      visibleIndex++;
      return;
    }

    // -------------------------
    // NORMAL HEADER LOGIC
    // -------------------------

    const rawHeader = slide?.header;

    if (!rawHeader || typeof rawHeader !== "string") return;

    const header = rawHeader.trim();
    if (!header) return;

    const normalized = header.toLowerCase();

    const isContinuation =
      normalized.includes("(continue)") ||
      normalized.includes("(continued)") ||
      normalized.endsWith("continue") ||
      normalized.endsWith("continued");

    if (isContinuation) return;

    sections.push({
      slideIndex,
      label: `1.${visibleIndex}`,
      title: header
    });

    visibleIndex++;
  });

  return sections;
}

// -------------------------
// Slide Index Safety
// -------------------------

function getMaxSlideIndex() {

  const resultsIndex = getResultsSlideIndex();

  if (resultsIndex !== null) {
    return resultsIndex;
  }

  return RuntimeState.slides.length - 1;
}

// -------------------------
// Navigation Setup
// -------------------------

function setupNavigation() {

  if (RuntimeState._navSetupDone) return;
  RuntimeState._navSetupDone = true;

  document.body.addEventListener("click", (event) => {

    const btn = event.target.closest("[data-nav]");
    if (!btn) return;

    // Tiny improvement:
    // only allow clicks from the actual nav shells
    if (!btn.closest("[data-nav-root]")) return;

    const action = btn.dataset.nav;

    /* -------------------------
       PREVIOUS
    ------------------------- */

    if (action === "prev") {

      if (RuntimeState.currentIndex > 0) {
        RuntimeState.currentIndex--;
        closeDrawer();
        saveProgress();
        renderSlide();
      }

      return;
    }

    /* -------------------------
       NEXT
    ------------------------- */

    if (action === "next") {

      const resultsIndex = getResultsSlideIndex();

      // Prevent Next from running on Results page
      if (RuntimeState.currentIndex === resultsIndex) return;

      const slide = RuntimeState.slides[RuntimeState.currentIndex];

      // Prevent skipping unanswered FINAL quiz questions
      if (slide?.type === "quiz" && (slide.quiz_scope || "inline") === "final") {

        const state = RuntimeState.quizState?.[RuntimeState.currentIndex]?.[0];

        if (!state || !state.submitted) {
          alert("Please answer the quiz question before continuing.");
          return;
        }

      }

      const maxIndex = getMaxSlideIndex();

      if (RuntimeState.currentIndex < maxIndex) {
        RuntimeState.currentIndex++;
        closeDrawer();
        saveProgress();
        renderSlide();
      }

      return;
    }

    /* -------------------------
       EXIT
    ------------------------- */

    if (action === "exit") {

      if (window.flutter_inappwebview) {
        window.flutter_inappwebview.callHandler("exitModule");
      } else {
        window.history.back();
      }

      return;
    }

    /* -------------------------
       MENU
    ------------------------- */

    if (action === "menu") {
      openDrawer("menu");
      return;
    }

  });

}

// -------------------------
// Slide Rendering Dispatcher
// -------------------------

async function renderSlide() {

  const container = document.getElementById("slide-container");

  /* -------------------------
     FADE OUT (start)
  ------------------------- */

  container.classList.add("slide-fade-out");

  setTimeout(() => {
    (async () => {

      closeDrawer();
      document.body.style.overflow = "";

      container.innerHTML = "";
      container.scrollTop = 0;

      const resultsIndex = getResultsSlideIndex();

      if (resultsIndex !== null && RuntimeState.currentIndex === resultsIndex) {
        renderFinalResults(container);
        updateNavigationUI();
        updateDrawerActiveState();
      } else {

        const slide = RuntimeState.slides[RuntimeState.currentIndex];
        if (!slide) return;

        await dispatchSlide(slide, container);
        updateNavigationUI();
        updateDrawerActiveState();
      }

      container.classList.remove("slide-fade-out");

    })().catch(err => {
      console.error("RENDER ERROR:", err);
    });

  }, 120);// small delay = smooth but fast
}

async function dispatchSlide(slide, container) {
  switch (slide.type) {

    case "panel":
      await renderPanel(slide, container);
      break;

    case "engage_1":
      renderEngage1(slide, container);
      break;

    case "engage_2":
      renderEngage2(slide, container);
      break;

    case "quiz":
      renderQuiz(slide, container);
      break;

    default:
      renderUnknown(slide, container);
  }
}

// -------------------------
// Update Navigation UI
// -------------------------

function updateNavigationUI() {

  const prevBtns = document.querySelectorAll('[data-nav="prev"]');
  const nextBtns = document.querySelectorAll('[data-nav="next"]');
  const counters = document.querySelectorAll('[data-role="counter"]');
  const progressFills = document.querySelectorAll('[data-role="progress-fill"]');

  const maxIndex = getMaxSlideIndex();

  /* -------------------------
     PREV BUTTON STATE
  ------------------------- */

  const disablePrev = RuntimeState.currentIndex === 0;

  prevBtns.forEach(btn => {
    btn.disabled = disablePrev;
  });

  /* -------------------------
     NEXT BUTTON STATE
  ------------------------- */

  let disableNext =
    RuntimeState.currentIndex === maxIndex;

  const slide = RuntimeState.slides[RuntimeState.currentIndex] || null;

  if (slide?.type === "quiz" && (slide.quiz_scope || "inline") === "final") {

    const state =
      RuntimeState.quizState?.[RuntimeState.currentIndex]?.[0];

    if (!state || !state.submitted) {
      disableNext = true;
    }

  }

  nextBtns.forEach(btn => {
    btn.disabled = disableNext;
  });

  /* -------------------------
     SLIDE COUNT
  ------------------------- */

  const resultsIndex = getResultsSlideIndex();

  const totalSlides =
    resultsIndex !== null
      ? resultsIndex + 1
      : RuntimeState.slides.length;

  counters.forEach(counter => {
    counter.textContent =
      `${RuntimeState.currentIndex + 1} / ${totalSlides}`;
  });

  /* -------------------------
     PROGRESS BAR
  ------------------------- */

  const progress =
    totalSlides > 0
      ? ((RuntimeState.currentIndex + 1) / totalSlides) * 100
      : 0;

  progressFills.forEach(fill => {

    const parent = fill.parentElement;

    if (parent.classList.contains("vertical")) {

      /* sidebar progress */
      fill.style.height = progress + "%";
      fill.style.width = "100%";

    } else {

      /* bottom bar progress */
      fill.style.width = progress + "%";
      fill.style.height = "100%";

    }

  });

}

// -------------------------
// Shared Content Block Renderer
// -------------------------

async function renderContentBlock({
  textArray = [],
  imageSrc = null,
  alt = ""
}) {
  const block = document.createElement("div");
  block.className = "engage-content-block";

  // Text
  if (textArray.length) {
    const textWrapper = document.createElement("div");
    textWrapper.className = "engage-text";

    textArray.forEach(block => {
      if (!block) return;

      // -------------------------
      // Paragraph
      // -------------------------
      if (typeof block === "string") {
        const p = document.createElement("p");
        p.textContent = block;
        textWrapper.appendChild(p);
        return;
      }

      if (block.type === "paragraph") {
        const p = document.createElement("p");
        p.textContent = block.text;
        textWrapper.appendChild(p);
      }

      // -------------------------
      // Bullets
      // -------------------------
      else if (block.type === "bullets") {
        const ul = document.createElement("ul");

        block.items.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });

        textWrapper.appendChild(ul);
      }
    });

    block.appendChild(textWrapper);
  }

  // Image (FIXED)
  if (imageSrc) {
    const img = await createReadyImage(
      imageSrc,
      alt,
      ""
    );

    // -------------------------
    // Image Wrapper
    // -------------------------
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    // Overlay label
    const overlay = document.createElement("div");
    overlay.className = "image-overlay";
    overlay.textContent = "Tap to expand";

    // Add click behavior
    wrapper.addEventListener("click", () => {
      openImageViewer(img.src);
    });

    wrapper.appendChild(img);
    wrapper.appendChild(overlay);

    block.appendChild(wrapper);
  }

  return block;
}

// -------------------------
// Panel Renderer
// -------------------------

async function renderPanel(slide, container) {
  renderHeader(slide, container);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "panel-content";

  const block = await renderContentBlock({
    textArray: slide.body || [],
    imageSrc: slide.image ? `assets/${slide.image}` : null,
    alt: slide.header || "Slide image",
    imageClass: "panel-image"
  });

  contentWrapper.appendChild(block);
  container.appendChild(contentWrapper);
}

// -------------------------
// Unknown Slide Type
// -------------------------

function renderUnknown(slide, container) {
  const msg = document.createElement("p");
  msg.textContent = `Unsupported slide type: ${slide.type}`;
  container.appendChild(msg);
}

// -------------------------
// Shared Header Renderer
// -------------------------

function renderHeader(slide, container) {
  if (!slide.header) return;

  const header = document.createElement("h2");
  header.textContent = slide.header;
  container.appendChild(header);
}

// -------------------------
// Image Viewer (Fullscreen)
// -------------------------

function openImageViewer(src) {
  const overlay = document.getElementById("image-viewer-overlay");
  const img = document.getElementById("image-viewer-img");

  if (!overlay || !img) return;

  img.src = src;
  overlay.classList.add("active");

  // Prevent background scroll
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  const overlay = document.getElementById("image-viewer-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");

  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("image-viewer-overlay");
  const closeBtn = document.getElementById("image-viewer-close");

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      // Only close if clicking background (not image)
      if (e.target === overlay) {
        closeImageViewer();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeImageViewer);
  }
});