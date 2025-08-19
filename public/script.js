document.addEventListener("DOMContentLoaded", function () {
  // Initialize the map
  const map = L.map("map").setView([15.5, 74], 9);

  // Add base layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Load JSON data
fetch("riskData.json")
  .then(res => res.json())
  .then(data => {
    Object.entries(data).forEach(([taluka, details]) => {
      if (!details.lat || !details.lng) {
        console.warn(`⚠️ No coordinates for ${taluka}, skipping marker`);
        return;
      }

      const marker = L.marker([details.lat, details.lng]).addTo(map);

      marker.on("click", () => {
        let html = `<h3>${taluka}</h3><ul>`;
        Object.entries(details).forEach(([key, value]) => {
          if (key !== "lat" && key !== "lng") {
            html += `<li><strong>${key}:</strong> ${value}</li>`;
          }
        });
        html += "</ul>";

        document.getElementById("info").innerHTML = html;
      });
    });
  });


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
