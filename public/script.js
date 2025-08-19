document.addEventListener("DOMContentLoaded", function () {
  // Initialize map
  const map = L.map("map").setView([15.4, 74], 9);

  // Base layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  let heatLayer;
  let climateData;

  // Function to update sidebar
  function showTalukaData(talukaName, data) {
    const container = document.getElementById("talukaData");
    container.innerHTML = `
      <h3>${talukaName}</h3>
      <ul>
        ${Object.entries(data)
          .filter(([k]) => k !== "lat" && k !== "lng" && k !== "riskScore")
          .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
          .join("")}
      </ul>
    `;
  }

  // Load JSON data
  fetch("riskData.json")
    .then(res => res.json())
    .then(data => {
      climateData = data;

      // Populate theme dropdown dynamically
      const first = Object.values(data)[0];
      const themes = Object.keys(first).filter(k => !["lat", "lng", "riskScore"].includes(k));
      const themeSelect = document.getElementById("themeFilter");
      themes.forEach(theme => {
        const opt = document.createElement("option");
        opt.value = theme;
        opt.textContent = theme;
        themeSelect.appendChild(opt);
      });

      // Create markers
      Object.entries(data).forEach(([taluka, details]) => {
        if (!details.lat || !details.lng) return;
        const marker = L.marker([details.lat, details.lng]).addTo(map);
        marker.on("click", () => {
          const selectedTheme = document.getElementById("themeFilter").value;
          let filtered = {};
          if (selectedTheme === "All") {
            filtered = details;
          } else {
            filtered = {
              [selectedTheme]: details[selectedTheme],
              lat: details.lat,
              lng: details.lng
            };
          }
          showTalukaData(taluka, filtered);
        });
      });
    })
    .catch(err => {
      console.error("Error loading data:", err);
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
});
