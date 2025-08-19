/* ===============================
   Goa Climate Risk Dashboard – script.js
   =============================== */

// --- Map bootstrapping ---
const map = L.map("map").setView([15.36, 74.02], 9);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Dynamic load of Leaflet.heat (no HTML edits needed)
(function loadHeat() {
  const s = document.createElement("script");
  s.src = "https://unpkg.com/leaflet.heat/dist/leaflet-heat.js";
  document.head.appendChild(s);
})();

// --- UI Elements / Globals ---
const infoPanel = document.getElementById("info-panel");
let currentMode = "taluka"; // "taluka" | "theme"
let currentTheme = "All";
let talukaMarkers = [];
let heatLayer = null;
let dataset = null;

// Taluka coordinates (approximate centroids for mapping)
const TALUKA_COORDS = {
  // North Goa
  "Bardez": [15.553, 73.80],
  "Tiswadi": [15.50, 73.83],
  "Pernem": [15.715, 73.795],
  "Bicholim": [15.60, 73.95],
  "Sattari": [15.55, 74.05],
  // South Goa
  "Salcete": [15.27, 73.95],
  "Mormugao": [15.38, 73.81],
  "Canacona": [14.99, 74.05],
  "Quepem": [15.22, 74.05],
  "Sanguem": [15.23, 74.15],
  "Dharbandora": [15.32, 74.23]
};

// Color scale for marker styling based on “intensity”
function riskColor(score) {
  // score is 0..1
  if (score >= 0.75) return "#c1121f"; // high - red
  if (score >= 0.5) return "#f28415";  // medium - orange
  if (score > 0) return "#ffd166";     // low - yellow
  return "#7cb342";                     // none - green
}

// Normalize value into 0..1 (min/max safe-guard)
function normalize(val, min, max) {
  if (max <= min) return 0;
  const n = (val - min) / (max - min);
  return Math.max(0, Math.min(1, n));
}

// Render controls (mode + theme + heatmap toggle)
(function mountControls() {
  const ctrl = L.control({ position: "topright" });
  ctrl.onAdd = function () {
    const div = L.DomUtil.create("div", "panel-controls");
    div.innerHTML = `
      <div class="control-row">
        <label class="lbl">Mode</label>
        <select id="modeSelect">
          <option value="taluka" selected>By Taluka</option>
          <option value="theme">By Theme</option>
        </select>
      </div>
      <div class="control-row">
        <label class="lbl">Theme</label>
        <select id="themeSelect">
          <option value="All" selected>All Themes</option>
        </select>
      </div>
      <div class="control-row">
        <label class="lbl">Heatmap</label>
        <label class="switch">
          <input type="checkbox" id="heatToggle">
          <span class="slider"></span>
        </label>
      </div>
    `;
    // Prevent map drag when interacting with controls
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  ctrl.addTo(map);
})();

// Legend
(function mountLegend() {
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
      <div class="legend-title">Risk Intensity</div>
      <div class="legend-item"><span class="box" style="background:#c1121f;"></span>High</div>
      <div class="legend-item"><span class="box" style="background:#f28415;"></span>Medium</div>
      <div class="legend-item"><span class="box" style="background:#ffd166;"></span>Low</div>
      <div class="legend-item"><span class="box" style="background:#7cb342;"></span>None</div>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legend.addTo(map);
})();

// --- Data loading ---
fetch("/riskData.json")
  .then((r) => {
    if (!r.ok) throw new Error("Failed to load /riskData.json");
    return r.json();
  })
  .then((json) => {
    dataset = json;
    const themes = collectThemes(dataset);
    hydrateThemeSelect(themes);
    renderTalukas(); // default
  })
  .catch((err) => {
    console.error(err);
    infoPanel.innerHTML = `<p style="color:#b00020">Error: unable to load risk data.</p>`;
  });

// Extract unique themes list from dataset
function collectThemes(data) {
  const set = new Set();
  Object.values(data).forEach((districtObj) => {
    Object.values(districtObj).forEach((talukaObj) => {
      Object.keys(talukaObj).forEach((theme) => set.add(theme));
    });
  });
  return Array.from(set).sort();
}

// Populate theme dropdown
function hydrateThemeSelect(themes) {
  const sel = document.getElementById("themeSelect");
  themes.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

// Compute “intensity” per taluka.
// If theme = "All": number of non-empty risk arrays across all themes.
// If specific theme: length of that theme’s risk array.
function talukaIntensity(talukaThemes, theme) {
  if (theme === "All") {
    const counts = Object.values(talukaThemes).map((arr) => (Array.isArray(arr) ? arr.length : 0));
    return counts.reduce((a, b) => a + b, 0);
  } else {
    const arr = talukaThemes[theme];
    return Array.isArray(arr) ? arr.length : 0;
  }
}

// Build a unified array of taluka rows with metadata
function flattenTalukas(data) {
  const rows = [];
  Object.entries(data).forEach(([district, talukas]) => {
    Object.entries(talukas).forEach(([talukaName, themes]) => {
      const coords = TALUKA_COORDS[talukaName];
      if (!coords) return; // skip unmapped
      rows.push({
        district,
        taluka: talukaName,
        lat: coords[0],
        lng: coords[1],
        themes
      });
    });
  });
  return rows;
}

// --- Rendering ---
function clearMarkers() {
  talukaMarkers.forEach((m) => map.removeLayer(m));
  talukaMarkers = [];
}

// Render talukas for current mode/theme
function renderTalukas() {
  if (!dataset) return;

  clearMarkers();
  removeHeat();

  const rows = flattenTalukas(dataset);
  // Calculate intensities
  const intensities = rows.map((r) => talukaIntensity(r.themes, currentTheme));
  const min = Math.min(...intensities);
  const max = Math.max(...intensities);

  // Markers
  rows.forEach((r, idx) => {
    const raw = intensities[idx];
    const score = normalize(raw, min, max);
    const color = riskColor(score);

    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 10 + Math.round(score * 8), // scale size by intensity
      color: "#333",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(`<strong>${r.taluka}</strong><br/><small>${r.district}</small>`);
    marker.on("click", () => {
      renderInfoPanel(r, currentTheme);
    });

    talukaMarkers.push(marker);
  });

  // Optionally add heatmap
  const heatEnabled = document.getElementById("heatToggle").checked;
  if (heatEnabled && typeof L.heatLayer === "function") {
    const heatData = rows.map((r, idx) => {
      const raw = intensities[idx];
      const s = normalize(raw, min, max);
      // Heat layer expects [lat, lng, intensity], keep intensity modest
      return [r.lat, r.lng, s || 0.0001];
    });
    heatLayer = L.heatLayer(heatData, {
      radius: 28,
      blur: 16,
      maxZoom: 12
    }).addTo(map);
  }
}

function removeHeat() {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
}

// Side panel rendering with accordion
function renderInfoPanel(row, theme) {
  const { taluka, district, themes } = row;
  let html = `<h2>${taluka}</h2><div class="muted">${district}</div>`;

  const entries = Object.entries(themes);

  if (theme !== "All") {
    // Focused theme view
    const risks = Array.isArray(themes[theme]) ? themes[theme] : [];
    html += accordionBlock(theme, risks);
  } else {
    // All themes – build accordions per theme
    entries.forEach(([th, risks]) => {
      html += accordionBlock(th, Array.isArray(risks) ? risks : []);
    });
  }

  infoPanel.innerHTML = html;
  wireAccordions();
}

// Generate one accordion block
function accordionBlock(title, risks) {
  const id = `acc-${Math.random().toString(36).slice(2, 9)}`;
  const items = risks.length
    ? risks.map((r) => `<li>${escapeHTML(r)}</li>`).join("")
    : `<li class="muted">No listed risks</li>`;
  return `
    <div class="accordion">
      <div class="accordion-header" data-target="${id}">
        <span>${escapeHTML(title)}</span>
        <span class="toggle">+</span>
      </div>
      <div id="${id}" class="accordion-content">
        <ul class="risk-list">${items}</ul>
      </div>
    </div>
  `;
}

// Escape HTML (safety)
function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Attach click handlers to accordions
function wireAccordions() {
  document.querySelectorAll(".accordion-header").forEach((hdr) => {
    hdr.addEventListener("click", () => {
      const id = hdr.getAttribute("data-target");
      const content = document.getElementById(id);
      const toggle = hdr.querySelector(".toggle");
      if (content.style.display === "block") {
        content.style.display = "none";
        toggle.textContent = "+";
      } else {
        content.style.display = "block";
        toggle.textContent = "–";
      }
    });
  });
}

// --- Events ---
document.addEventListener("change", (e) => {
  if (e.target.id === "modeSelect") {
    currentMode = e.target.value;
    // NOTE: For now both modes render the same markers,
    // but in "theme" mode we visually/semantically filter by selected theme.
    renderTalukas();
    infoPanel.innerHTML = `<div class="muted">Select a taluka marker to view details.</div>`;
  }
  if (e.target.id === "themeSelect") {
    currentTheme = e.target.value;
    renderTalukas();
    infoPanel.innerHTML = `<div class="muted">Select a taluka marker to view "${currentTheme}" risks.</div>`;
  }
  if (e.target.id === "heatToggle") {
    renderTalukas();
  }
});

// Initial panel state
infoPanel.innerHTML = `<h2>Goa Climate Risks</h2>
<p class="muted">Click a taluka marker to view SAPCC-aligned thematic risks. Use the controls to switch mode, filter by theme, and toggle the heatmap.</p>`;
