// runtime.js (bootstrap only)
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

