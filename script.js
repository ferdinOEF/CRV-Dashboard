let map;
let talukaMarkers = [];
let heatLayer;
let riskData = {};

async function initMap() {
  // Initialize map centered on Goa
  map = L.map("map").setView([15.3, 74.0], 9);

  // Add base map
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  // Load risk data from public folder
  try {
    const response = await fetch("/riskData.json");
    if (!response.ok) throw new Error("Could not load riskData.json");
    riskData = await response.json();
  } catch (err) {
    console.error("Error loading riskData.json:", err);
    return;
  }

  addTalukaMarkers();
  populateThemeFilter();
}

function addTalukaMarkers() {
  talukaMarkers.forEach(m => map.removeLayer(m));
  talukaMarkers = [];

  Object.entries(riskData).forEach(([district, talukas]) => {
    Object.entries(talukas).forEach(([taluka, themes]) => {
      // Use dummy coordinates (replace with actual per taluka later)
      let coords = getTalukaCoords(taluka);
      if (!coords) return;

      let marker = L.marker(coords).addTo(map);
      marker.bindPopup(`<b>${taluka}</b><br>${formatThemes(themes)}`);
      talukaMarkers.push(marker);
    });
  });
}

function formatThemes(themes) {
  return Object.entries(themes)
    .map(([theme, details]) => `<b>${theme}</b>: ${details.risk || ""}`)
    .join("<br>");
}

function getTalukaCoords(taluka) {
  const coords = {
    "Bardez": [15.6, 73.8],
    "Pernem": [15.75, 73.75],
    "Bicholim": [15.6, 74.0],
    "Sattari": [15.55, 74.1],
    "Tiswadi": [15.5, 73.9],
    "Ponda": [15.4, 74.0],
    "Salcete": [15.25, 73.95],
    "Mormugao": [15.4, 73.8],
    "Canacona": [14.99, 74.05],
    "Quepem": [15.2, 74.1],
    "Sanguem": [15.2, 74.2],
    "Dharbandora": [15.3, 74.2],
  };
  return coords[taluka] || null;
}

function populateThemeFilter() {
  const themes = new Set();
  Object.values(riskData).forEach(talukas => {
    Object.values(talukas).forEach(themesObj => {
      Object.keys(themesObj).forEach(theme => themes.add(theme));
    });
  });

  const select = document.getElementById("themeFilter");
  themes.forEach(theme => {
    let option = document.createElement("option");
    option.value = theme;
    option.textContent = theme;
    select.appendChild(option);
  });

  select.addEventListener("change", filterByTheme);
}

function filterByTheme() {
  const selected = document.getElementById("themeFilter").value;
  talukaMarkers.forEach(m => m.remove());

  talukaMarkers = [];
  Object.entries(riskData).forEach(([district, talukas]) => {
    Object.entries(talukas).forEach(([taluka, themes]) => {
      let coords = getTalukaCoords(taluka);
      if (!coords) return;

      if (selected === "All" || Object.keys(themes).includes(selected)) {
        let marker = L.marker(coords).addTo(map);
        marker.bindPopup(`<b>${taluka}</b><br>${formatThemes(themes)}`);
        talukaMarkers.push(marker);
      }
    });
  });
}

// Start
initMap();
