// runtime_drawer.js

// -------------------------
// Drawer UI State
// -------------------------

if (!window.RuntimeUI) {
  window.RuntimeUI = {
    drawerOpen: false,
    drawerInitialized: false,
    resultsShown: false, 
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