let map;
let riskData = {};
let markers = [];
let heatLayer;
let themeFilter = "All";

async function loadData() {
  try {
    const response = await fetch("/riskData.json"); // ✅ since it's in /public
    riskData = await response.json();
    initMap();
    populateThemeFilter();
  } catch (err) {
    console.error("Error loading riskData.json:", err);
  }
}

function initMap() {
  map = L.map("map").setView([15.4, 73.8], 9);

  // Base map
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Plot taluka markers
  Object.keys(riskData).forEach(district => {
    Object.keys(riskData[district]).forEach(taluka => {
      const tData = riskData[district][taluka];
      const marker = L.marker(tData.coordinates)
        .addTo(map)
        .bindPopup(`<b>${taluka}</b><br>${district}`);

      marker.on("click", () => showTalukaData(taluka, tData));

      markers.push({
        taluka,
        district,
        themes: tData.themes,
        coords: tData.coordinates
      });
    });
  });
}

function populateThemeFilter() {
  const select = document.getElementById("themeFilter");
  let themes = new Set();

  markers.forEach(m => {
    Object.keys(m.themes).forEach(th => themes.add(th));
  });

  themes.forEach(th => {
    const opt = document.createElement("option");
    opt.value = th;
    opt.textContent = th;
    select.appendChild(opt);
  });

  select.addEventListener("change", e => {
    themeFilter = e.target.value;
    updateHeatmap();
  });

  document.getElementById("heatmapToggle").addEventListener("click", () => {
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
      document.getElementById("heatmapToggle").textContent = "Show Heatmap";
    } else {
      updateHeatmap();
      document.getElementById("heatmapToggle").textContent = "Hide Heatmap";
    }
  });
}

function updateHeatmap() {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }

  const heatPoints = [];

  markers.forEach(m => {
    let intensity = 0;

    if (themeFilter === "All") {
      intensity = Object.values(m.themes).reduce((a, b) => a + b.score, 0);
    } else if (m.themes[themeFilter]) {
      intensity = m.themes[themeFilter].score;
    }

    heatPoints.push([m.coords[0], m.coords[1], intensity]);
  });

  heatLayer = L.heatLayer(heatPoints, { radius: 25 }).addTo(map);
}

function showTalukaData(taluka, data) {
  document.getElementById("talukaName").textContent = taluka;
  const container = document.getElementById("themeData");
  container.innerHTML = "";

  Object.entries(data.themes).forEach(([theme, info]) => {
    if (themeFilter === "All" || theme === themeFilter) {
      const section = document.createElement("div");
      section.className = "theme-section";
      section.innerHTML = `
        <h3>${theme}</h3>
        <p><b>Score:</b> ${info.score}</p>
        <p>${info.details}</p>
      `;
      container.appendChild(section);
    }
  });
}

// Start
loadData();
