// Initialize map
const map = L.map('map').setView([15.4, 73.9], 9);

// Basemap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const infoPanel = document.getElementById("info");

// Load JSON
fetch("riskData.json")
  .then(response => response.json())
  .then(data => {
    const heatPoints = [];

    // Loop through talukas
    Object.keys(data).forEach(district => {
      Object.keys(data[district]).forEach(taluka => {
        const talukaData = data[district][taluka];

        if (talukaData.lat && talukaData.lng) {
          // Add marker
          const marker = L.marker([talukaData.lat, talukaData.lng])
            .addTo(map)
            .bindPopup(`<b>${taluka}, ${district}</b>`);

          // Click event to show info
          marker.on("click", () => {
            infoPanel.innerHTML = `<h3>${taluka} (${district})</h3>`;
            Object.keys(talukaData.themes).forEach(theme => {
              infoPanel.innerHTML += `<div class="taluka-title">${theme}</div>`;
              infoPanel.innerHTML += `<div class="theme-item">${talukaData.themes[theme]}</div>`;
            });
          });

          // Push for heatmap (use risk score if available, else random weight)
          const weight = talukaData.riskScore ? talukaData.riskScore / 10 : 0.5;
          heatPoints.push([talukaData.lat, talukaData.lng, weight]);
        }
      });
    });

    // Add heatmap
    L.heatLayer(heatPoints, { radius: 30, blur: 20 }).addTo(map);
  })
  .catch(err => {
    console.error("Error loading riskData.json:", err);
    infoPanel.innerHTML = "<p style='color:red'>Failed to load risk data.</p>";
  });
