// Initialize the map
var map = L.map("map").setView([15.4, 74.0], 9);

// Add OpenStreetMap base layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Load risk data
fetch("riskData.json")
  .then((response) => response.json())
  .then((riskData) => {
    // Add markers for districts
    var northGoa = L.marker([15.6, 73.8]).addTo(map)
      .bindPopup("North Goa – Click for Risks")
      .on("click", () => showRiskDetails("North Goa", riskData));

    var southGoa = L.marker([15.2, 74.0]).addTo(map)
      .bindPopup("South Goa – Click for Risks")
      .on("click", () => showRiskDetails("South Goa", riskData));

    // Function to expand hierarchical data
    function formatRisks(obj, level = 0) {
      let html = "<ul>";
      for (let [key, value] of Object.entries(obj)) {
        if (typeof value === "object") {
          html += `<li><b>${key}</b>${formatRisks(value, level + 1)}</li>`;
        } else {
          html += `<li>${key}: ${value}</li>`;
        }
      }
      html += "</ul>";
      return html;
    }

    // Show details in side panel
    function showRiskDetails(region, data) {
      let risks = data[region];
      let details = `<h2>${region}</h2>`;
      details += formatRisks(risks);
      document.getElementById("info-panel").innerHTML = details;
    }
  })
  .catch((err) => console.error("Error loading riskData.json:", err));
