document.addEventListener("DOMContentLoaded", function () {
  const map = L.map("map").setView([15.4, 74], 9);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  let heatLayer;
  let climateData;

  function getMarkerColor(score) {
    if (score <= 0.6) return "#2ecc71";   // green
    if (score <= 0.7) return "#f1c40f";   // yellow
    if (score <= 0.75) return "#e67e22";  // orange
    return "#e74c3c";                     // red
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

  fetch("riskData.json")
    .then(res => res.json())
    .then(data => {
      climateData = data;
      const first = Object.values(data)[0];
      const themes = Object.keys(first).filter(k => !["lat","lng","riskScore"].includes(k));

      const themeSelect = document.getElementById("themeFilter");
      themes.forEach(theme => {
        const opt = document.createElement("option");
        opt.value = theme;
        opt.textContent = theme;
        themeSelect.appendChild(opt);
      });

      Object.entries(data).forEach(([taluka, details]) => {
        if (!details.lat || !details.lng) return;

        const marker = L.circleMarker([details.lat, details.lng], {
          radius: 8,
          fillColor: getMarkerColor(details.riskScore),
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(map);

        marker.on("click", () => showTalukaData(taluka, details));
      });
    });

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
});
