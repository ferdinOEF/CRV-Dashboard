document.addEventListener("DOMContentLoaded", function () {
  // Initialize the map
  const map = L.map("map").setView([15.5, 74], 9);

  // Add base layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Load JSON data
  fetch("riskData.json")
    .then(response => response.json())
    .then(data => {
      // Iterate over each taluka in JSON
      for (const [taluka, info] of Object.entries(data)) {
        if (!info.coordinates) {
          console.warn(`⚠️ No coordinates for ${taluka}, skipping marker`);
          continue;
        }

        const marker = L.marker(info.coordinates).addTo(map);

        // On marker click, show details in sidebar
        marker.on("click", () => {
          showTalukaData(taluka, info);
        });
      }
    })
    .catch(err => console.error("Error loading riskData.json:", err));

  // Function to update sidebar content
  function showTalukaData(talukaName, data) {
    const container = document.getElementById("talukaData");
    if (!container) {
      console.error("No #talukaData element found!");
      return;
    }
    container.innerHTML = `
      <h3>${talukaName}</h3>
      <p><strong>Theme:</strong> ${data.theme}</p>
      <p><strong>Vulnerabilities:</strong> ${data.vulnerabilities}</p>
    `;
  }
});
