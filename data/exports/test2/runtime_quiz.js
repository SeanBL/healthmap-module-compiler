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
    ensureFinalShufflePlan();
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

  let orderedOptions = options;

  if (scope === "final") {
    ensureFinalShufflePlan();

    const key = finalKey(slideIndex, qIndex);
    const order = RuntimeState.final.optionOrder[key];

    if (order && order.length) {
      const byId = new Map(options.map(o => [o.id, o]));
      orderedOptions = order.map(id => byId.get(id)).filter(Boolean);
    }
  }

  orderedOptions.forEach((opt) => {
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
// Final Results Screen
// -------------------------

function renderFinalResults(container) {

  const { percent, correct, total } = RuntimeState.final;
  const passed = percent >= 80;

  const wrapper = document.createElement("div");
  wrapper.className = "results-wrapper";

  // Title
  const title = document.createElement("h2");
  title.textContent = "Results";
  wrapper.appendChild(title);

  // Score circle + percent
  const score = document.createElement("div");
  score.className = "results-score";

  const percentText = document.createElement("div");
  percentText.className = "results-percent";
  percentText.textContent = `${percent}%`;

  const scoreLabel = document.createElement("div");
  scoreLabel.className = "results-label";
  scoreLabel.textContent = "Your Score";

  score.appendChild(percentText);
  score.appendChild(scoreLabel);

  wrapper.appendChild(score);

  // Correct count
  const correctBox = document.createElement("div");
  correctBox.className = "results-correct";
  correctBox.textContent = `${correct} / ${total} Questions Correct`;
  wrapper.appendChild(correctBox);

  // Passing score
  const passing = document.createElement("div");
  passing.className = "results-passmark";
  passing.textContent = "Passing Score: 80%";
  wrapper.appendChild(passing);

  // Pass / Fail message
  const message = document.createElement("div");
  message.className = passed
    ? "results-pass"
    : "results-fail";

  message.textContent = passed
    ? "🎉 Congratulations, you passed!"
    : "You did not reach the passing score.";

  wrapper.appendChild(message);

  // Buttons container
  const buttons = document.createElement("div");
  buttons.className = "results-buttons";

  // Save CME button
  const saveBtn = document.createElement("button");
  saveBtn.className = "results-btn primary";
  saveBtn.textContent = "Save Score for CME";
  saveBtn.onclick = saveScoreForCme;

  // Review button
  const reviewBtn = document.createElement("button");
  reviewBtn.className = "results-btn secondary";
  reviewBtn.textContent = "Review Quiz";
  reviewBtn.onclick = () => {
    RuntimeState.currentIndex = findFirstFinalQuizSlide();
    saveProgress();
    renderSlide();
  };

  // Retry button
  const retryBtn = document.createElement("button");
  retryBtn.className = "results-btn dark";
  retryBtn.textContent = "Retry Quiz";
  retryBtn.onclick = resetFinalQuizOnly;

  // Back to module
  const backBtn = document.createElement("button");
  backBtn.className = "results-btn dark";
  backBtn.textContent = "Back to Module";
  backBtn.onclick = () => {
    RuntimeState.final.completed = false;
    RuntimeState.currentIndex = 0;
    saveProgress();
    renderSlide();
  };

  buttons.appendChild(saveBtn);
  buttons.appendChild(reviewBtn);
  buttons.appendChild(retryBtn);
  buttons.appendChild(backBtn);

  wrapper.appendChild(buttons);

  container.appendChild(wrapper);
}

function findFirstFinalQuizSlide() {
  for (let i = 0; i < RuntimeState.slides.length; i++) {
    const s = RuntimeState.slides[i];
    if (s.type === "quiz" && (s.quiz_scope || "inline") === "final") {
      return i;
    }
  }
  return 0;
}

function resetFinalQuizOnly() {

  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,
    attemptSeed: null,
    questionOrder: [],
    optionOrder: {}
  };

  RuntimeState.slides.forEach((slide, index) => {
    if (slide.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
      delete RuntimeState.quizState[index];
    }
  });

  RuntimeState.currentIndex = findFirstFinalQuizSlide();

  saveProgress();
  renderSlide();
}

function buildFinalQuizIndex() {

  if (!Array.isArray(RuntimeState.final.questions)) {
    RuntimeState.final.questions = [];
  }

  if (RuntimeState.final.questions.length > 0) return;

  RuntimeState.slides.forEach((slide, slideIndex) => {

    if (slide.type !== "quiz") return;
    if ((slide.quiz_scope || "inline") !== "final") return;
    if (!Array.isArray(slide.questions)) return;

    slide.questions.forEach((q, qIndex) => {

      RuntimeState.final.questions.push({
        slideIndex,
        qIndex
      });

    });

  });

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
  if (!Array.isArray(RuntimeState.final.questions)) {
    buildFinalQuizIndex();
  }

  let total = 0;
  let correct = 0;
  let allSubmitted = true;

  RuntimeState.final.questions.forEach(({slideIndex, qIndex}) => {

    total++;

    const st = RuntimeState.quizState?.[slideIndex]?.[qIndex];

    if (!st || !st.submitted) {
      allSubmitted = false;
    }

    if (st && st.submitted && st.correct) {
      correct++;
    }

  });

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  RuntimeState.final.total = total;
  RuntimeState.final.correct = correct;
  RuntimeState.final.percent = percent;
  RuntimeState.final.completed = total > 0 && allSubmitted;

  saveProgress();

  renderFinalScoreBox();
  notifyFlutterIfComplete();
  if (!RuntimeState.final.completed) {
    RuntimeUI.resultsShown = false;
  }

  if (RuntimeState.final.completed && !RuntimeUI.resultsShown) {
    RuntimeUI.resultsShown = true;
    renderSlide();
    return;
  }
}

// -------------------------
// Save CME Score
// -------------------------
async function saveScoreForCme() {
  if (!window.flutter_inappwebview?.callHandler) {
    console.warn("Flutter handler not available.");
    return;
  }

  const payload = {
    module_id: RuntimeState.moduleId,
    module_name: window.moduleName || "",
    quiz_score: RuntimeState.final.percent,
    passed: RuntimeState.final.percent >= 80,
    saved_at: new Date().toISOString()
  };

  const response = await window.flutter_inappwebview.callHandler(
    "saveCmeScore",
    payload
  );

  if (response?.status === "ok") {
    clearFinalQuizFromLocalStorage();
  }
}

function clearFinalQuizFromLocalStorage() {
  // Clear only FINAL quiz state
  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,
    attemptSeed: null,
    questionOrder: [],
    optionOrder: {}
  };

  // Remove only final-scope quiz entries
  RuntimeState.slides.forEach((slide, index) => {
    if (slide.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
      delete RuntimeState.quizState[index];
    }
  });

  saveProgress();
}

// -------------------------
// Seeded RNG + Shuffle
// -------------------------

// Mulberry32: small fast seeded RNG
function seededRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffleArray(arr, rand) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Creates a new attempt seed (changes every restart/reset)
function newAttemptSeed() {
  // stable enough + integer
  return Math.floor(Date.now() % 2147483647);
}

function finalKey(slideIndex, qIndex) {
  return `${slideIndex}:${qIndex}`;
}

function ensureFinalShufflePlan() {
  // If we already have a plan, keep it (resume/review must NOT reshuffle)
  if (
    typeof RuntimeState.final.attemptSeed === "number" &&
    Array.isArray(RuntimeState.final.questionOrder) &&
    RuntimeState.final.questionOrder.length > 0
  ) {
    return;
  }

  // Make a new attempt seed
  RuntimeState.final.attemptSeed = newAttemptSeed();

  const rand = seededRng(RuntimeState.final.attemptSeed);

  // Collect ALL final questions across slides
  const finalQuestions = [];
  RuntimeState.slides.forEach((s, slideIndex) => {
    if (s.type !== "quiz") return;
    if ((s.quiz_scope || "inline") !== "final") return;
    if (!Array.isArray(s.questions)) return;

    s.questions.forEach((q, qIndex) => {
      finalQuestions.push({ slideIndex, qIndex });
    });
  });

  // Shuffle question order
  RuntimeState.final.questionOrder = seededShuffleArray(finalQuestions, rand);

  // Shuffle options per question (store option ID order)
  RuntimeState.final.optionOrder = {};

  RuntimeState.final.questionOrder.forEach(({ slideIndex, qIndex }) => {
    const q = RuntimeState.slides[slideIndex]?.questions?.[qIndex];
    if (!q) return;

    const options = normalizeOptions(RuntimeState.slides[slideIndex], q);
    const optionIds = options.map(o => o.id);

    RuntimeState.final.optionOrder[finalKey(slideIndex, qIndex)] =
      seededShuffleArray(optionIds, rand);
  });

  saveProgress();
}