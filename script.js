// script.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize map
  const map = L.map("map").setView([15.4, 74.0], 9);

  // Tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Load risk data
  fetch("/riskData.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load riskData.json");
      return res.json();
    })
    .then((data) => {
      console.log("Risk data loaded:", data); // Debug in console

      data.forEach((district) => {
        const marker = L.marker([district.lat, district.lng]).addTo(map);
        marker.bindPopup(
          `<b>${district.name}</b><br>
          <ul>
            ${district.risks.map(r => `<li>${r}</li>`).join("")}
          </ul>`
        );
      });
    })
    .catch((err) => {
      console.error("Error loading risk data:", err);
    });
});
