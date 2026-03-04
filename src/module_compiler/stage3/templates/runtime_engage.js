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