// Initialize the map
var map = L.map("map").setView([15.4, 74.0], 9);

// Add OpenStreetMap base layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Load risk data
fetch("/riskData.json")
  .then((response) => response.json())
  .then((riskData) => {
    // Add markers for districts
    var northGoa = L.marker([15.6, 73.8]).addTo(map)
      .bindPopup("North Goa – Click for Risks")
      .on("click", () => showRiskDetails("North Goa", riskData));

    var southGoa = L.marker([15.2, 74.0]).addTo(map)
      .bindPopup("South Goa – Click for Risks")
      .on("click", () => showRiskDetails("South Goa", riskData));

    /**
     * Recursively format nested risk data into collapsible accordions
     */
    function formatRisks(obj, level = 0) {
      let html = "<ul>";
      for (let [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null) {
          let id = `section-${Math.random().toString(36).substr(2, 9)}`;
          html += `
            <li>
              <div class="accordion-header" data-target="${id}">
                <span>${key}</span>
                <span class="toggle">+</span>
              </div>
              <div id="${id}" class="accordion-content">
                ${formatRisks(value, level + 1)}
              </div>
            </li>
          `;
        } else {
          html += `<li>${key}: ${value}</li>`;
        }
      }
      html += "</ul>";
      return html;
    }

    /**
     * Show risk details in side panel
     */
    function showRiskDetails(region, data) {
      let risks = data[region];
      if (!risks) {
        document.getElementById("info-panel").innerHTML = `<h2>No data for ${region}</h2>`;
        return;
      }
      let details = `<h2>${region}</h2>`;
      details += formatRisks(risks);
      document.getElementById("info-panel").innerHTML = details;

      // Attach accordion click events
      document.querySelectorAll(".accordion-header").forEach(header => {
        header.addEventListener("click", function () {
          let target = document.getElementById(this.dataset.target);
          let toggle = this.querySelector(".toggle");
          if (target.style.display === "block") {
            target.style.display = "none";
            toggle.textContent = "+";
          } else {
            target.style.display = "block";
            toggle.textContent = "–";
          }
        });
      });
    }
  })
  .catch((err) => console.error("Error loading riskData.json:", err));
