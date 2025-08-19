// script.js

// Initialize the map
const map = L.map("map").setView([15.2993, 74.1240], 9);

// Add OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Load risk data from /public/riskData.json
fetch("riskData.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Failed to load riskData.json");
    }
    return response.json();
  })
  .then((data) => {
    data.forEach((district) => {
      const marker = L.marker([district.lat, district.lng]).addTo(map);

      // Popup with district risks
      marker.bindPopup(`
        <div>
          <h3>${district.name}</h3>
          <ul>
            ${district.risks
              .map((risk) => `<li><strong>${risk.type}:</strong> ${risk.level}</li>`)
              .join("")}
          </ul>
        </div>
      `);
    });
  })
  .catch((error) => {
    console.error("Error loading risk data:", error);
  });
