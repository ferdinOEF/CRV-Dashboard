// Initialize map
var map = L.map("map").setView([15.4, 73.9], 9);

// Add basemap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Load risk data from external JSON
fetch("/riskData.json")
  .then(response => response.json())
  .then(riskData => {
    // Add markers for Goa districts
    var northGoa = L.marker([15.6, 73.8]).addTo(map)
      .bindPopup("North Goa – Click for Risks")
      .on("click", () => showRiskDetails("North Goa", riskData));

    var southGoa = L.marker([15.2, 74.0]).addTo(map)
      .bindPopup("South Goa – Click for Risks")
      .on("click", () => showRiskDetails("South Goa", riskData));

    // Function to show risk details in bottom panel
    function showRiskDetails(region, data) {
      let risks = data[region];
      if (!risks) {
        document.getElementById("info-panel").innerHTML = `<h3>${region}</h3><p>No data available.</p>`;
        return;
      }

      let details = `<h3>${region}</h3><ul>`;
      for (let [key, value] of Object.entries(risks)) {
        details += `<li><b>${key}:</b> ${value}</li>`;
      }
      details += "</ul>";
      document.getElementById("info-panel").innerHTML = details;
    }
  })
  .catch(err => console.error("Error loading riskData.json:", err));
