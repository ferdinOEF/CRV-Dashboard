let currentMode = "taluka"; // taluka | theme
let currentTheme = "All";
let markers = [];

// Load data
fetch('riskData.json')
  .then(res => res.json())
  .then(data => {

    function clearMarkers() {
      markers.forEach(m => map.removeLayer(m));
      markers = [];
    }

    // Render by Taluka (default)
    function renderByTaluka(theme) {
      clearMarkers();
      data.talukas.forEach(t => {
        const marker = L.marker([t.lat, t.lng]).addTo(map);

        let popupContent = `<h3>${t.name}</h3>`;
        if (theme === "All") {
          for (const [th, risks] of Object.entries(t.themes)) {
            popupContent += `<strong>${th}</strong><ul>`;
            risks.forEach(r => popupContent += `<li>${r}</li>`);
            popupContent += `</ul>`;
          }
        } else if (t.themes[theme]) {
          popupContent += `<strong>${theme}</strong><ul>`;
          t.themes[theme].forEach(r => popupContent += `<li>${r}</li>`);
          popupContent += `</ul>`;
        } else {
          popupContent += `<em>No data for ${theme}</em>`;
        }

        marker.bindPopup(popupContent);
        markers.push(marker);
      });
    }

    // Render by Theme (inverse view)
    function renderByTheme(theme) {
      clearMarkers();
      if (theme === "All") {
        alert("Please select a specific theme to view geographic spread.");
        return;
      }

      data.talukas.forEach(t => {
        if (t.themes[theme]) {
          const marker = L.marker([t.lat, t.lng]).addTo(map);
          let popupContent = `<h3>${t.name}</h3><strong>${theme}</strong><ul>`;
          t.themes[theme].forEach(r => popupContent += `<li>${r}</li>`);
          popupContent += `</ul>`;
          marker.bindPopup(popupContent);
          markers.push(marker);
        }
      });
    }

    // Initial render
    renderByTaluka("All");

    // Controls
    const controls = L.control({position: 'topright'});
    controls.onAdd = function() {
      const div = L.DomUtil.create('div', 'view-controls');
      div.innerHTML = `
        <div>
          <label>Mode:</label>
          <select id="modeSelect">
            <option value="taluka">By Taluka</option>
            <option value="theme">By Theme</option>
          </select>
        </div>
        <div>
          <label>Theme:</label>
          <select id="themeSelect">
            <option value="All">All</option>
            ${data.themes.map(th => `<option value="${th}">${th}</option>`).join('')}
          </select>
        </div>
      `;
      return div;
    };
    controls.addTo(map);

    // Event listeners
    document.addEventListener('change', e => {
      if (e.target.id === "modeSelect") {
        currentMode = e.target.value;
      }
      if (e.target.id === "themeSelect") {
        currentTheme = e.target.value;
      }

      if (currentMode === "taluka") {
        renderByTaluka(currentTheme);
      } else {
        renderByTheme(currentTheme);
      }
    });
  });
