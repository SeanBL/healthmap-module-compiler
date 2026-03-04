// -------------------------
// Runtime State
// -------------------------

const RuntimeState = {
  moduleId: null,
  title: "",
  slides: [],
  resources: [],
  currentIndex: 0,

  // quizState[slideIndex][questionIndex] = { selectedOptionId, submitted, correct }
  quizState: {},

  // we will store computed final quiz results here too
  final: {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false
  },

  engageState: {}
};

function storageKey() {
  return `healthmap_runtime::${RuntimeState.moduleId || "unknown"}`;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (typeof saved.currentIndex === "number") RuntimeState.currentIndex = saved.currentIndex;
    if (saved.quizState) RuntimeState.quizState = saved.quizState;
    if (saved.final) RuntimeState.final = saved.final;

    if (saved.engageState) RuntimeState.engageState = saved.engageState;

  } catch (e) {
    console.warn("Progress load failed:", e);
  }
}

function saveProgress() {
  try {
    const payload = {
      currentIndex: RuntimeState.currentIndex,
      quizState: RuntimeState.quizState,
      final: RuntimeState.final,

      engageState: RuntimeState.engageState
    };
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch (e) {
    console.warn("Progress save failed:", e);
  }
}

function hasSavedProgress() {
  const saved = localStorage.getItem(storageKey());
  if (!saved) return false;

  try {
    const data = JSON.parse(saved);

    if (data.currentIndex > 0) return true;
    if (data.quizState && Object.keys(data.quizState).length > 0) return true;
    if (data.engageState && Object.keys(data.engageState).length > 0) return true;

    return false;
  } catch {
    return false;
  }
}

function ensureEngageState(slideIndex) {
  if (!RuntimeState.engageState[slideIndex]) {
    RuntimeState.engageState[slideIndex] = {};
  }
  return RuntimeState.engageState[slideIndex];
}

// -------------------------
// Initialization
// -------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await loadModule();
  setupNavigation();
  setupDrawer();
  setupResume();

  if (RuntimeState.moduleId && hasSavedProgress()) {
    openResume();
  } else {
    renderSlide();
  }
});

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
// Drawer UI State
// -------------------------

if (!window.RuntimeUI) {
  window.RuntimeUI = {
    drawerOpen: false,
    drawerInitialized: false
  };
}

// -------------------------
// Drawer Setup (Bind Once)
// -------------------------

function setupDrawer() {
  if (RuntimeUI.drawerInitialized) return;

  const menuBtn = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("drawer-close");
  const overlay = document.getElementById("drawer-overlay");
  const content = document.getElementById("drawer-content");

  console.log("[Drawer] menuBtn:", !!menuBtn, "closeBtn:", !!closeBtn, "overlay:", !!overlay, "content:", !!content);

  if (!menuBtn || !closeBtn || !overlay) {
    console.warn("Drawer elements missing.");
    return;
  }

  menuBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  // Click outside content closes drawer
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeDrawer();
    }
  });

  RuntimeUI.drawerInitialized = true;
  console.log("[Drawer] Initialized");
}

// -------------------------
// Drawer Controls
// -------------------------

function openDrawer() {
  const resumeOverlay = document.getElementById("resume-overlay");
  if (resumeOverlay && resumeOverlay.classList.contains("active")) {
    console.log("Drawer blocked by resume");
    return;
  }

  if (RuntimeUI.drawerOpen) {
    console.log("Already open");
    return;
  }

  const overlay = document.getElementById("drawer-overlay");
  const content = document.getElementById("drawer-content");

  if (!overlay || !content) {
    console.log("Missing overlay or content");
    return;
  }

  content.innerHTML = "";
  renderDrawerResources(content);

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  RuntimeUI.drawerOpen = true;
}

function closeDrawer() {
  if (!RuntimeUI.drawerOpen) return;

  const overlay = document.getElementById("drawer-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");
  document.body.style.overflow = "";
  RuntimeUI.drawerOpen = false;
}

// -------------------------
// Drawer Renderer
// -------------------------

function renderDrawerResources(container) {
  if (!Array.isArray(RuntimeState.resources) || RuntimeState.resources.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No resources available.";
    container.appendChild(p);
    return;
  }

  const list = document.createElement("div");
  list.className = "drawer-resource-list";

  RuntimeState.resources.forEach(resource => {
    const item = document.createElement("div");
    item.className = "drawer-resource-item";

    const title = document.createElement("div");
    title.className = "drawer-resource-title";
    title.textContent = resource.title || resource.file;

    const actions = document.createElement("div");
    actions.className = "drawer-resource-actions";

    // View Button
    const viewBtn = document.createElement("a");
    viewBtn.textContent = "View";
    viewBtn.href = `assets/resources/${resource.file}`;
    viewBtn.target = "_blank";
    viewBtn.className = "drawer-resource-btn";

    // Download Button
    const downloadBtn = document.createElement("a");
    downloadBtn.textContent = "Download";
    downloadBtn.href = `assets/resources/${resource.file}`;
    downloadBtn.setAttribute("download", resource.file);
    downloadBtn.className = "drawer-resource-btn";

    actions.appendChild(viewBtn);
    actions.appendChild(downloadBtn);

    item.appendChild(title);
    item.appendChild(actions);

    list.appendChild(item);
  });

  container.appendChild(list);
}

// -------------------------
// Resume/Reset Option Prompt
// -------------------------

function showResumePrompt() {
  const overlay = document.getElementById("resume-overlay");
  overlay.classList.remove("hidden");

  const continueBtn = document.getElementById("resume-continue");
  const restartBtn = document.getElementById("resume-restart");

  continueBtn.onclick = () => {
    overlay.classList.add("hidden");
    renderSlide();
  };

  restartBtn.onclick = () => {
    resetModuleProgress();
    overlay.classList.add("hidden");
    renderSlide();
  };
}

function resetModuleProgress() {
  RuntimeState.currentIndex = 0;
  RuntimeState.quizState = {};
  RuntimeState.engageState = {};
  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false
  };

  localStorage.removeItem(storageKey());
}

function setupResume() {
  const overlay = document.getElementById("resume-overlay");
  const continueBtn = document.getElementById("resume-continue");
  const restartBtn = document.getElementById("resume-restart");

  if (!overlay || !continueBtn || !restartBtn) return;

  continueBtn.addEventListener("click", () => {
    closeResume();
    renderSlide();
  });

  restartBtn.addEventListener("click", () => {
    resetModuleProgress();
    closeResume();
    renderSlide();
  });
}

function openResume() {
  const overlay = document.getElementById("resume-overlay");
  if (!overlay) return;

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeResume() {
  const overlay = document.getElementById("resume-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");
  document.body.style.overflow = "";
}

// -------------------------
// Slide Rendering Dispatcher
// -------------------------

function renderSlide() {
  closeDrawer();
  document.body.style.overflow = "";
  const container = document.getElementById("slide-container");
  container.innerHTML = "";

  const slide = RuntimeState.slides[RuntimeState.currentIndex];
  if (!slide) return;

  dispatchSlide(slide, container);

  updateNavigationUI();
}

// -------------------------
// Dispatcher
// -------------------------

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
// Engage 1 Renderer
// -------------------------

function renderEngage1(slide, container) {
  renderHeader(slide, container);

  const wrapper = document.createElement("div");
  wrapper.className = "engage1-wrapper";

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "engage1-buttons";

  const contentArea = document.createElement("div");
  contentArea.className = "engage1-content";

  const items = Array.isArray(slide.items) ? slide.items : [];

  function renderIntro() {
    contentArea.innerHTML = "";

    if (slide.intro) {
      const intro = document.createElement("p");
      intro.textContent = slide.intro;
      intro.className = "engage1-intro";
      contentArea.appendChild(intro);
    }

    if (slide.intro_image) {
      const introImg = document.createElement("img");
      introImg.src = `assets/${slide.intro_image}`;
      introImg.alt = "Intro image";
      introImg.className = "engage1-image";
      contentArea.appendChild(introImg);
    }
  }

  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.textContent = item.label || `Item ${index + 1}`;
    btn.className = "engage1-btn";

    btn.addEventListener("click", () => {
      renderEngage1Item(item, contentArea);

      Array.from(buttonContainer.children).forEach(b =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
    });

    buttonContainer.appendChild(btn);
  });

  wrapper.appendChild(buttonContainer);
  wrapper.appendChild(contentArea);
  container.appendChild(wrapper);

  // Always reset to intro
  renderIntro();
}

// -------------------------
// Render Engage1 Item Content
// -------------------------

function renderEngage1Item(item, contentArea) {
  contentArea.innerHTML = "";

  if (item.image) {
    const img = document.createElement("img");
    img.src = `assets/${item.image}`;
    img.alt = item.label || "Item image";
    img.className = "engage1-image";
    contentArea.appendChild(img);
  }

  if (item.text) {
    const p = document.createElement("p");
    p.textContent = item.text;
    contentArea.appendChild(p);
  }
}

// -------------------------
// Engage 2 Renderer
// -------------------------

function renderEngage2(slide, container) {
  renderHeader(slide, container);

  const slideIndex = RuntimeState.currentIndex;
  const engage = ensureEngageState(slideIndex);

  const wrapper = document.createElement("div");
  wrapper.className = "engage2-wrapper";

  // Intro
  if (slide.intro) {
    const intro = document.createElement("p");
    intro.textContent = slide.intro;
    intro.className = "engage2-intro";
    wrapper.appendChild(intro);
  }

  if (slide.intro_image) {
    const introImg = document.createElement("img");
    introImg.src = `assets/${slide.intro_image}`;
    introImg.alt = "Intro image";
    introImg.className = "engage2-image";
    wrapper.appendChild(introImg);
  }

  // Reveal Button
  const revealBtn = document.createElement("button");
  revealBtn.textContent = slide.button_label || "Continue";
  revealBtn.className = "engage2-btn";

  // Content Stack Area
  const stackArea = document.createElement("div");
  stackArea.className = "engage2-stack";

  const layers = Array.isArray(slide.layers) ? slide.layers : [];

  // Restore revealed layers
  let revealedCount = 0;
  if (
    typeof engage.revealedCount === "number" &&
    engage.revealedCount >= 0
  ) {
    revealedCount = Math.min(engage.revealedCount, layers.length);
  }

  for (let i = 0; i < revealedCount; i++) {
    appendEngage2Layer(layers[i], stackArea);
  }

  let currentLayerIndex = revealedCount;

  // Disable button if already complete
  if (currentLayerIndex >= layers.length) {
    revealBtn.disabled = true;
  }

  revealBtn.addEventListener("click", () => {
    if (currentLayerIndex >= layers.length) return;

    appendEngage2Layer(layers[currentLayerIndex], stackArea);
    currentLayerIndex++;

    // Persist progress
    engage.revealedCount = currentLayerIndex;
    saveProgress();

    if (currentLayerIndex >= layers.length) {
      revealBtn.disabled = true;
    }
  });

  wrapper.appendChild(revealBtn);
  wrapper.appendChild(stackArea);
  container.appendChild(wrapper);

  // Persist default (even if 0 layers revealed)
  if (typeof engage.revealedCount !== "number") {
    engage.revealedCount = revealedCount;
    saveProgress();
  }
}

// -------------------------
// Append Engage2 Layer
// -------------------------

function appendEngage2Layer(layer, stackArea) {
  const layerWrapper = document.createElement("div");
  layerWrapper.className = "engage2-layer";

  if (layer.image) {
    const img = document.createElement("img");
    img.src = `assets/${layer.image}`;
    img.alt = "Layer image";
    img.className = "engage2-image";
    layerWrapper.appendChild(img);
  }

  if (layer.text) {
    const p = document.createElement("p");
    p.textContent = layer.text;
    layerWrapper.appendChild(p);
  }

  stackArea.appendChild(layerWrapper);
}

// -------------------------
// Quiz Renderer (Stub)
// -------------------------

function renderQuiz(slide, container) {
  renderHeader(slide, container);

  const scope = slide.quiz_scope || "inline"; // "inline" or "final"

  const wrapper = document.createElement("div");
  wrapper.className = "quiz-wrapper";

  // Optional scope label (subtle)
  const scopeLabel = document.createElement("p");
  scopeLabel.className = "quiz-scope";
  scopeLabel.textContent = scope === "final" ? "Final Quiz" : "Knowledge Check";
  wrapper.appendChild(scopeLabel);

  if (!Array.isArray(slide.questions) || slide.questions.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No quiz questions found.";
    wrapper.appendChild(p);
    container.appendChild(wrapper);
    return;
  }

  slide.questions.forEach((q, qIndex) => {
    const block = renderQuizQuestionBlock(slide, q, qIndex, RuntimeState.currentIndex, scope);
    wrapper.appendChild(block);
  });

  // If final scope: show running score box
  if (scope === "final") {
    const scoreBox = document.createElement("div");
    scoreBox.className = "quiz-final-score";
    scoreBox.id = "final-score-box";
    wrapper.appendChild(scoreBox);

    recomputeFinalScoreAndRender();
  }

  container.appendChild(wrapper);
}

function ensureQuizState(slideIndex, qIndex) {
  if (!RuntimeState.quizState[slideIndex]) RuntimeState.quizState[slideIndex] = {};
  if (!RuntimeState.quizState[slideIndex][qIndex]) {
    RuntimeState.quizState[slideIndex][qIndex] = {
      selectedOptionId: null,
      submitted: false,
      correct: false
    };
  }
  return RuntimeState.quizState[slideIndex][qIndex];
}
// -------------------------
// Question Block Renderer
// -------------------------
function renderQuizQuestionBlock(slide, q, qIndex, slideIndex, scope) {
  const state = ensureQuizState(slideIndex, qIndex);

  const block = document.createElement("div");
  block.className = "quiz-question";

  const prompt = document.createElement("p");
  prompt.className = "quiz-prompt";
  prompt.textContent = q.prompt || `Question ${qIndex + 1}`;
  block.appendChild(prompt);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "quiz-options";

  const options = normalizeOptions(slide, q);
  options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "quiz-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `q_${slideIndex}_${qIndex}`;
    input.value = opt.id;
    input.disabled = state.submitted;

    if (state.selectedOptionId === opt.id) input.checked = true;

    input.addEventListener("change", () => {
      state.selectedOptionId = opt.id;
      saveProgress();
    });

    const span = document.createElement("span");
    span.textContent = opt.text;

    label.appendChild(input);
    label.appendChild(span);
    optionsWrap.appendChild(label);
  });

  block.appendChild(optionsWrap);

  const actions = document.createElement("div");
  actions.className = "quiz-actions";

  const submitBtn = document.createElement("button");
  submitBtn.className = "quiz-submit";
  submitBtn.textContent = state.submitted ? "Submitted" : "Submit";
  submitBtn.disabled = state.submitted;

  const feedback = document.createElement("div");
  feedback.className = "quiz-feedback";

  submitBtn.addEventListener("click", () => {
    if (!state.selectedOptionId) {
      feedback.textContent = "Please select an answer, then submit.";
      feedback.className = "quiz-feedback quiz-feedback-warn";
      return;
    }

    // Validate
    const correctId = q.correct_option_id;
    state.correct = state.selectedOptionId === correctId;
    state.submitted = true;
    saveProgress();

    // Lock all radios
    Array.from(optionsWrap.querySelectorAll("input[type=radio]")).forEach(inp => {
      inp.disabled = true;
    });

    // Update submit
    submitBtn.textContent = "Submitted";
    submitBtn.disabled = true;

    // Feedback + explanation
    feedback.className = state.correct
      ? "quiz-feedback quiz-feedback-correct"
      : "quiz-feedback quiz-feedback-incorrect";

    const exp = q.explanation ? ` Explanation: ${q.explanation}` : "";
    feedback.textContent = (state.correct ? "Correct." : "Incorrect.") + exp;

    // If final: recompute score
    if (scope === "final") {
      recomputeFinalScoreAndRender();
    }
  });

  actions.appendChild(submitBtn);
  block.appendChild(actions);
  block.appendChild(feedback);

  // If already submitted (restored from storage), show feedback immediately
  if (state.submitted) {
    feedback.className = state.correct
      ? "quiz-feedback quiz-feedback-correct"
      : "quiz-feedback quiz-feedback-incorrect";
    const exp = q.explanation ? ` Explanation: ${q.explanation}` : "";
    feedback.textContent = (state.correct ? "Correct." : "Incorrect.") + exp;
  }

  return block;
}

function normalizeOptions(slide, q) {
  // MCQ: q.options provided
  if (Array.isArray(q.options) && q.options.length) return q.options;

  // True/False: generate standard options if missing
  if (slide.quiz_type === "true_false") {
    return [
      { id: "true", text: "True" },
      { id: "false", text: "False" }
    ];
  }

  // Fallback: empty
  return [];
}

// -------------------------
// Render Final Score
// -------------------------

function renderFinalScoreBox() {
  const box = document.getElementById("final-score-box");
  if (!box) return;

  const { total, correct, percent, completed } = RuntimeState.final;

  box.innerHTML = "";

  const scoreLine = document.createElement("div");
  scoreLine.textContent =
    `Final Quiz Score: ${correct}/${total} (${percent}%)`;

  box.appendChild(scoreLine);

  if (!completed) {
    const status = document.createElement("div");
    status.style.marginTop = "0.5rem";
    status.textContent = "Complete all questions to finish the final quiz.";
    box.appendChild(status);
  } else {
    const status = document.createElement("div");
    status.style.marginTop = "0.5rem";
    status.style.fontWeight = "600";
    status.textContent = "Final Quiz Complete. Ready to submit.";
    box.appendChild(status);
  }
}

// -------------------------
// Notify Flutter
// -------------------------

function notifyFlutterIfComplete() {
  const { completed } = RuntimeState.final;
  if (!completed) return;

  if (window.flutter_inappwebview &&
      window.flutter_inappwebview.callHandler) {

    window.flutter_inappwebview.callHandler(
      "finalQuizCompleted",
      {
        moduleId: RuntimeState.moduleId,
        score: RuntimeState.final.percent,
        total: RuntimeState.final.total,
        correct: RuntimeState.final.correct
      }
    );
  }
}

// -------------------------
// Final Score Computation
// -------------------------

function recomputeFinalScoreAndRender() {
  let total = 0;
  let correct = 0;
  let allSubmitted = true;

  RuntimeState.slides.forEach((s, sIndex) => {
    if (s.type !== "quiz") return;
    if ((s.quiz_scope || "inline") !== "final") return;
    if (!Array.isArray(s.questions)) return;

    s.questions.forEach((q, qIndex) => {
      total += 1;

      const st = RuntimeState.quizState?.[sIndex]?.[qIndex];

      if (!st || !st.submitted) {
        allSubmitted = false;
      }

      if (st && st.submitted && st.correct) {
        correct += 1;
      }
    });
  });

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  RuntimeState.final = {
    total,
    correct,
    percent,
    completed: total > 0 && allSubmitted
  };

  saveProgress();

  renderFinalScoreBox();
  notifyFlutterIfComplete();
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
// Slide Type Label (Temporary)
// -------------------------

function renderTypeLabel(text, container) {
  const label = document.createElement("p");
  label.style.fontStyle = "italic";
  label.style.opacity = "0.6";
  label.textContent = text;
  container.appendChild(label);
}

window.HealthMAPRuntime = {
  getModuleId: () => RuntimeState.moduleId,
  getFinalScore: () => RuntimeState.final,
  isFinalComplete: () => RuntimeState.final.completed,
  getProgress: () => ({
    currentIndex: RuntimeState.currentIndex,
    quizState: RuntimeState.quizState,
    engageState: RuntimeState.engageState,
    final: RuntimeState.final
  })
};