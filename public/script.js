document.addEventListener("DOMContentLoaded", function () {
  const map = L.map("map").setView([15.4, 74], 9);

  // Base layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  let heatLayer, climateData, wasteLayer;

  // ----------------------------
  // Helpers
  // ----------------------------

  function getRiskColor(score) {
    if (score <= 0.6) return "#2ecc71";   // green
    if (score <= 0.7) return "#f1c40f";   // yellow
    if (score <= 0.75) return "#e67e22";  // orange
    return "#e74c3c";                     // red
  }

  function getWasteColor(type) {
    if (type.includes("MRF") || type.includes("Processing")) return "#34495e";   // dark grey
    if (type.includes("Proposed")) return "#95a5a6";  // light grey
    return "#7f8c8d";  // default grey for dumpsites / hotspots
  }

  function showTalukaData(talukaName, data) {
    const container = document.getElementById("talukaData");
    const selectedTheme = document.getElementById("themeFilter").value;

    let html = `<h3>${talukaName}</h3><ul>`;
    Object.entries(data).forEach(([key, value]) => {
      if (["lat","lng","riskScore"].includes(key)) return;
      if (selectedTheme === "All" || key === selectedTheme) {
        html += `<li data-theme="${key}"><strong>${key}:</strong> ${value}</li>`;
      }
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  function showWasteSite(siteName, details) {
    const container = document.getElementById("talukaData");
    container.innerHTML = `
      <h3>${siteName}</h3>
      <ul>
        <li><strong>Type:</strong> ${details.type}</li>
        <li><strong>Status:</strong> ${details.status}</li>
      </ul>
    `;
  }

  // ----------------------------
  // Climate Risk Layer
  // ----------------------------
  fetch("riskData.json")
    .then(res => res.json())
    .then(data => {
      climateData = data;
      const first = Object.values(data)[0];
      const themes = Object.keys(first).filter(k => !["lat","lng","riskScore"].includes(k));

      // Populate theme dropdown
      const themeSelect = document.getElementById("themeFilter");
      themes.forEach(theme => {
        const opt = document.createElement("option");
        opt.value = theme;
        opt.textContent = theme;
        themeSelect.appendChild(opt);
      });

      // Add taluka markers
      Object.entries(data).forEach(([taluka, details]) => {
        if (!details.lat || !details.lng) return;

        const marker = L.circleMarker([details.lat, details.lng], {
          radius: 8,
          fillColor: getRiskColor(details.riskScore),
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(map);

        marker.on("click", () => showTalukaData(taluka, details));
      });
    });

  // Heatmap toggle
  document.getElementById("toggleHeatmap").addEventListener("click", () => {
    if (!climateData) return;
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
      return;
    }
    const points = Object.values(climateData)
      .filter(d => d.lat && d.lng)
      .map(d => [d.lat, d.lng, d.riskScore || 0.5]);
    heatLayer = L.heatLayer(points, { radius: 25 }).addTo(map);
  });

  // ----------------------------
  // Waste Layer
  // ----------------------------
  document.getElementById("toggleWaste").addEventListener("click", () => {
    if (wasteLayer) {
      map.removeLayer(wasteLayer);
      wasteLayer = null;
      return;
    }

    fetch("wasteData.json")
      .then(res => res.json())
      .then(wasteData => {
        const markers = [];
        Object.entries(wasteData).forEach(([site, details]) => {
          const marker = L.circleMarker([details.lat, details.lng], {
            radius: 9,
            fillColor: getWasteColor(details.type),
            color: "#fff",
            weight: 1,
            fillOpacity: 0.9
          }).bindPopup(
            `<strong>${site}</strong><br>
             Type: ${details.type}<br>
             Status: ${details.status}`
          );

          marker.on("click", () => showWasteSite(site, details));
          markers.push(marker);
        });
        wasteLayer = L.layerGroup(markers).addTo(map);
      });
  });
});
