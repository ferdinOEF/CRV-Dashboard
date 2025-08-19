/* Goa Climate Risk Dashboard – script.js (Vercel public-aware)
   - Expects /public/riskData.json available at /riskData.json
   - Leaflet + leaflet.heat already loaded via CDN in index.html
*/

// ---- Map init ----
const map = L.map("map").setView([15.36, 74.02], 9);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// ---- Globals ----
const infoPanel = document.getElementById("info-content");
let dataset = null;
let talukaRows = [];
let talukaMarkers = [];
let heatLayer = null;
let currentTheme = "All";

// Fallback coords if JSON has only [location] or none
const TALUKA_COORDS = {
  // North Goa
  "Pernem": [15.715, 73.795],
  "Bardez": [15.553, 73.80],
  "Tiswadi": [15.50, 73.83],
  "Bicholim": [15.60, 73.95],
  "Sattari": [15.55, 74.05],
  "Ponda": [15.408, 74.014],
  // South Goa
  "Mormugao": [15.389, 73.815],
  "Salcete": [15.30, 73.957],
  "Quepem": [15.228, 74.070],
  "Sanguem": [15.24, 74.165],
  "Dharbandora": [15.322, 74.183],
  "Canacona": [15.018, 74.023]
};

// Risk level → numeric weight (for heatmap & sizing)
function levelWeight(level = "") {
  const L = String(level).toLowerCase();
  if (L === "high") return 3;
  if (L === "medium") return 2;
  if (L === "low") return 1;
  if (L.includes("state")) return 1.5; // "Statewide concern"
  return 1;
}

// Color scale based on normalized score
function riskColor(score) {
  if (score >= 0.75) return "#c1121f"; // high
  if (score >= 0.5)  return "#f28415"; // medium
  if (score > 0)     return "#ffd166"; // low
  return "#7cb342";                   // none
}
function normalize(val, min, max) {
  if (max <= min) return 0;
  const n = (val - min) / (max - min);
  return Math.max(0, Math.min(1, n));
}

// Build Leaflet control (Theme filter + Heatmap toggle)
(function mountControls(){
  const ctrl = L.control({ position: "topright" });
  ctrl.onAdd = function() {
    const div = L.DomUtil.create("div", "panel-controls");
    div.innerHTML = `
      <div class="control-row">
        <label class="lbl">Theme</label>
        <select id="themeSelect"><option value="All" selected>All Themes</option></select>
      </div>
      <div class="control-row">
        <label class="lbl">Heatmap</label>
        <label class="switch">
          <input type="checkbox" id="heatToggle" />
          <span class="slider"></span>
        </label>
      </div>
    `;
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

// ---- Data load (PUBLIC path) ----
fetch("/riskData.json")
  .then(r => {
    if (!r.ok) throw new Error(`Failed to load /riskData.json (${r.status})`);
    return r.json();
  })
  .then(json => {
    dataset = json;
    talukaRows = flattenTalukas(dataset);
    hydrateThemeDropdown(collectThemes(talukaRows));
    renderTalukas(); // initial view
  })
  .catch(err => {
    console.error(err);
    infoPanel.innerHTML = `<p style="color:#b00020">Error: unable to load risk data.</p>`;
  });

// ---- Helpers to shape data ----
function flattenTalukas(data) {
  const rows = [];
  Object.entries(data).forEach(([district, talukas]) => {
    Object.entries(talukas).forEach(([talukaName, obj]) => {
      // Accept either obj.location [lat,lng] OR obj.lat/obj.lng OR fallback to static map
      let lat, lng;
      if (Array.isArray(obj.location) && obj.location.length === 2) {
        [lat, lng] = obj.location;
      } else if (typeof obj.lat === "number" && typeof obj.lng === "number") {
        lat = obj.lat; lng = obj.lng;
      } else if (TALUKA_COORDS[talukaName]) {
        [lat, lng] = TALUKA_COORDS[talukaName];
      } else {
        return; // skip if no coordinates
      }

      // risks can be under obj.risks (thematic object) OR obj.themes (string lists)
      const risks = obj.risks || obj.themes || {};
      rows.push({ district, taluka: talukaName, lat, lng, risks });
    });
  });
  return rows;
}

function collectThemes(rows) {
  const set = new Set();
  rows.forEach(r => {
    Object.keys(r.risks || {}).forEach(theme => set.add(theme));
  });
  return Array.from(set).sort();
}

function hydrateThemeDropdown(themes) {
  const sel = document.getElementById("themeSelect");
  themes.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t.replaceAll("_", " & ");
    sel.appendChild(opt);
  });
}

// ---- Rendering ----
function clearMarkers() {
  talukaMarkers.forEach(m => map.removeLayer(m));
  talukaMarkers = [];
}
function removeHeat() {
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
}

function talukaIntensity(risks, theme) {
  if (!risks) return 0;
  // Two possible shapes:
  // 1) risks[theme] = { level, description, ... }
  // 2) risks[theme] = [ "risk item", ... ]  (older list format)
  if (theme === "All") {
    return Object.values(risks).reduce((sum, v) => {
      if (Array.isArray(v)) return sum + (v.length || 0);
      if (v && typeof v === "object") return sum + levelWeight(v.level);
      return sum;
    }, 0);
  } else {
    const v = risks[theme];
    if (Array.isArray(v)) return v.length || 0;
    if (v && typeof v === "object") return levelWeight(v.level);
    return 0;
  }
}

function renderTalukas() {
  if (!talukaRows.length) return;

  clearMarkers();
  removeHeat();

  // Compute intensities
  const intensities = talukaRows.map(r => talukaIntensity(r.risks, currentTheme));
  const min = Math.min(...intensities);
  const max = Math.max(...intensities);

  // Markers
  talukaRows.forEach((r, idx) => {
    const raw = intensities[idx];
    const score = normalize(raw, min, max);
    const color = riskColor(score);

    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 10 + Math.round(score * 8),
      color: "#333",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(`<strong>${r.taluka}</strong><br/><small>${r.district}</small>`);
    marker.on("click", () => renderInfoPanel(r, currentTheme));

    talukaMarkers.push(marker);
  });

  // Heatmap
  const heatEnabled = document.getElementById("heatToggle").checked;
  if (heatEnabled && typeof L.heatLayer === "function") {
    const heatData = talukaRows.map((r, idx) => {
      const s = normalize(intensities[idx], min, max);
      return [r.lat, r.lng, s || 0.0001];
    });
    heatLayer = L.heatLayer(heatData, { radius: 28, blur: 16, maxZoom: 12 }).addTo(map);
  }
}

// Panel
function renderInfoPanel(row, theme) {
  const { taluka, district, risks } = row;
  let html = `<h2>${escapeHTML(taluka)} <span class="muted">(${escapeHTML(district)})</span></h2>`;

  const entries = Object.entries(risks || {});
  if (!entries.length) {
    infoPanel.innerHTML = html + `<div class="muted">No risks listed.</div>`;
    return;
  }

  if (theme !== "All") {
    html += accordionBlock(theme, risks[theme]);
  } else {
    entries.forEach(([th, obj]) => { html += accordionBlock(th, obj); });
  }

  infoPanel.innerHTML = html;
  wireAccordions();
}

// One accordion for a theme
function accordionBlock(themeKey, value) {
  const id = `acc-${Math.random().toString(36).slice(2, 9)}`;
  const title = themeKey.replaceAll("_", " & ");

  // Support both shapes
  let itemsHTML = "";
  let badge = "";
  if (Array.isArray(value)) {
    itemsHTML = value.map(x => `<li>${escapeHTML(x)}</li>`).join("") || `<li class="muted">No listed risks</li>`;
  } else if (value && typeof value === "object") {
    const lvl = (value.level || "").toLowerCase();
    const badgeClass = lvl === "high" ? "high" : (lvl === "medium" ? "medium" : (lvl === "low" ? "low" : "state"));
    badge = value.level ? ` <span class="badge ${badgeClass}">${escapeHTML(value.level)}</span>` : "";
    const desc = value.description ? `<li>${escapeHTML(value.description)}</li>` : "";
    const ev   = value.evidence ? `<li><em>${escapeHTML(value.evidence)}</em></li>` : "";
    const src  = value.source_tag ? `<li class="muted">Source: ${escapeHTML(value.source_tag)}</li>` : "";
    itemsHTML = desc + ev + src || `<li class="muted">No details</li>`;
  } else {
    itemsHTML = `<li class="muted">No details</li>`;
  }

  return `
    <div class="accordion">
      <div class="accordion-header" data-target="${id}">
        <span>${escapeHTML(title)}${badge}</span>
        <span class="toggle">+</span>
      </div>
      <div id="${id}" class="accordion-content">
        <ul class="risk-list">${itemsHTML}</ul>
      </div>
    </div>
  `;
}

function wireAccordions() {
  document.querySelectorAll(".accordion-header").forEach(h => {
    h.addEventListener("click", () => {
      const id = h.getAttribute("data-target");
      const content = document.getElementById(id);
      const toggle = h.querySelector(".toggle");
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      toggle.textContent = open ? "+" : "–";
    });
  });
}

function escapeHTML(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

// ---- Events ----
document.addEventListener("change", (e) => {
  if (e.target.id === "themeSelect") {
    currentTheme = e.target.value;
    renderTalukas();
    infoPanel.innerHTML = `<div class="muted">Select a taluka marker to view "${currentTheme}" risks.</div>`;
  }
  if (e.target.id === "heatToggle") {
    renderTalukas();
  }
});
