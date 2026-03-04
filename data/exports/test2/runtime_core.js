// runtime_core.js

// -------------------------
// Load Module JSON
// -------------------------

async function loadModule() {
  try {
    const response = await fetch("module.json");
    const data = await response.json();

    RuntimeState.moduleId = data.module_id || data.moduleId || null;
    RuntimeState.title = data.title || "HealthMAP Module";
    RuntimeState.slides = data.slides || [];
    RuntimeState.resources = data.resources || [];
    buildFinalQuizIndex();

    document.getElementById("module-title").textContent = RuntimeState.title;

    // Load saved progress AFTER moduleId is known
    if (RuntimeState.moduleId) loadProgress();

  } catch (err) {
    console.error("Failed to load module:", err);
  }
}

// -------------------------
// Navigation Setup
// -------------------------

function setupNavigation() {
  document.getElementById("prev-btn")
    .addEventListener("click", () => {
      if (RuntimeState.currentIndex > 0) {
        RuntimeState.currentIndex--;
        closeDrawer();
        saveProgress();
        renderSlide();
      }
    });

  document.getElementById("next-btn")
    .addEventListener("click", () => {
      if (RuntimeState.currentIndex < RuntimeState.slides.length - 1) {
        RuntimeState.currentIndex++;
        closeDrawer();
        saveProgress();
        renderSlide();
      }
    });
}

// -------------------------
// Slide Rendering Dispatcher
// -------------------------

function renderSlide() {
  closeDrawer();
  document.body.style.overflow = "";

  const container = document.getElementById("slide-container");
  container.innerHTML = "";

  // If final quiz finished → show results
  if (RuntimeState.final.completed) {
    renderFinalResults(container);
    updateNavigationUI();
    return;
  }

  const slide = RuntimeState.slides[RuntimeState.currentIndex];
  if (!slide) return;

  dispatchSlide(slide, container);

  updateNavigationUI();
}

function dispatchSlide(slide, container) {
  switch (slide.type) {

    case "panel":
      renderPanel(slide, container);
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
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const counter = document.getElementById("slide-counter");

  prevBtn.disabled = RuntimeState.currentIndex === 0;
  nextBtn.disabled =
    RuntimeState.currentIndex === RuntimeState.slides.length - 1;

  counter.textContent =
    `${RuntimeState.currentIndex + 1} / ${RuntimeState.slides.length}`;
}

// -------------------------
// Panel Renderer
// -------------------------

function renderPanel(slide, container) {
  renderHeader(slide, container);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "panel-content";

  // Render image (if exists)
  if (slide.image) {
    const img = document.createElement("img");
    img.src = `assets/${slide.image}`;
    img.alt = slide.header || "Slide image";
    img.className = "panel-image";
    contentWrapper.appendChild(img);
  }

  // Render paragraphs
  if (Array.isArray(slide.body)) {
    slide.body.forEach(paragraphText => {
      if (!paragraphText) return;

      const p = document.createElement("p");
      p.textContent = paragraphText;
      contentWrapper.appendChild(p);
    });
  }

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