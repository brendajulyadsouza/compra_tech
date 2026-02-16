const A11Y_STORAGE_KEY = "compratech_a11y_v1";
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.3;
const STEP_SCALE = 0.05;

const a11yDefaults = {
  theme: "light",
  fontScale: 1,
  contrast: false,
  readableFont: false,
  underline: false,
  reduceMotion: false,
};

function loadA11y() {
  try {
    const data = JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) || "{}");
    return { ...a11yDefaults, ...data };
  } catch {
    return { ...a11yDefaults };
  }
}

function saveA11y(state) {
  localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(state));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyA11y(state) {
  document.body.classList.toggle("theme-dark", state.theme === "dark");
  document.body.classList.toggle("high-contrast", !!state.contrast);
  document.body.classList.toggle("readable-font", !!state.readableFont);
  document.body.classList.toggle("underline-links", !!state.underline);
  document.body.classList.toggle("reduce-motion", !!state.reduceMotion);
  document.documentElement.style.setProperty("--user-font-scale", String(state.fontScale));

  const scaleText = document.getElementById("font-scale-value");
  if (scaleText) scaleText.textContent = `${Math.round(state.fontScale * 100)}%`;

  document.querySelectorAll("[data-theme]").forEach((button) => {
    const selected = button.getAttribute("data-theme");
    button.setAttribute("aria-pressed", String(selected === state.theme));
  });

  const contrast = document.getElementById("opt-contrast");
  const readableFont = document.getElementById("opt-readable-font");
  const underline = document.getElementById("opt-underline");
  const reduceMotion = document.getElementById("opt-reduce-motion");
  if (contrast) contrast.setAttribute("aria-pressed", String(!!state.contrast));
  if (readableFont) readableFont.setAttribute("aria-pressed", String(!!state.readableFont));
  if (underline) underline.setAttribute("aria-pressed", String(!!state.underline));
  if (reduceMotion) reduceMotion.setAttribute("aria-pressed", String(!!state.reduceMotion));
}

function initAccessibilityPanel() {
  const panel = document.getElementById("a11y-panel");
  const toggle = document.getElementById("a11y-toggle");
  if (!panel || !toggle) return;

  let state = loadA11y();
  applyA11y(state);

  toggle.addEventListener("click", () => {
    const isHidden = panel.hasAttribute("hidden");
    if (isHidden) {
      panel.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
    } else {
      panel.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.getAttribute("data-theme");
      state = { ...state, theme: selected === "dark" ? "dark" : "light" };
      saveA11y(state);
      applyA11y(state);
    });
  });

  const dec = document.getElementById("font-dec");
  const inc = document.getElementById("font-inc");
  const reset = document.getElementById("font-reset");
  if (dec) {
    dec.addEventListener("click", () => {
      state = { ...state, fontScale: clamp(state.fontScale - STEP_SCALE, MIN_SCALE, MAX_SCALE) };
      saveA11y(state);
      applyA11y(state);
    });
  }
  if (inc) {
    inc.addEventListener("click", () => {
      state = { ...state, fontScale: clamp(state.fontScale + STEP_SCALE, MIN_SCALE, MAX_SCALE) };
      saveA11y(state);
      applyA11y(state);
    });
  }
  if (reset) {
    reset.addEventListener("click", () => {
      state = { ...state, fontScale: 1 };
      saveA11y(state);
      applyA11y(state);
    });
  }

  const contrast = document.getElementById("opt-contrast");
  const readableFont = document.getElementById("opt-readable-font");
  const underline = document.getElementById("opt-underline");
  const reduceMotion = document.getElementById("opt-reduce-motion");

  if (contrast) {
    contrast.addEventListener("click", () => {
      state = { ...state, contrast: !state.contrast };
      saveA11y(state);
      applyA11y(state);
    });
  }
  if (readableFont) {
    readableFont.addEventListener("click", () => {
      state = { ...state, readableFont: !state.readableFont };
      saveA11y(state);
      applyA11y(state);
    });
  }
  if (underline) {
    underline.addEventListener("click", () => {
      state = { ...state, underline: !state.underline };
      saveA11y(state);
      applyA11y(state);
    });
  }
  if (reduceMotion) {
    reduceMotion.addEventListener("click", () => {
      state = { ...state, reduceMotion: !state.reduceMotion };
      saveA11y(state);
      applyA11y(state);
    });
  }
}

initAccessibilityPanel();
