// script.js

let map;
let riskData = {};
let markers = [];

// Initialize map
function initMap() {
  map = L.map('map').setView([15.2993, 74.1240], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Load riskData.json
  fetch('/riskData.json')
    .then(response => response.json())
    .then(data => {
      riskData = data;
      console.log("✅ Risk data loaded:", riskData);

      addTalukaMarkers();
    })
    .catch(err => console.error("❌ Error loading riskData.json:", err));
}

// Add markers for each taluka
function addTalukaMarkers() {
  Object.keys(riskData).forEach(taluka => {
    const { lat, lng } = riskData[taluka];

    if (!lat || !lng) {
      console.warn(`⚠️ No coordinates for ${taluka}, skipping marker`);
      return;
    }

    const marker = L.marker([lat, lng]).addTo(map);
    marker.on('click', () => showTalukaData(taluka));
    markers.push(marker);
  });
}

// Show taluka data when clicked
function showTalukaData(taluka) {
  console.log(`📍 Marker clicked: ${taluka}`);

  const data = riskData[taluka];
  const infoDiv = document.getElementById('taluka-info');

  if (!data) {
    console.error(`❌ No data found for: ${taluka}`);
    infoDiv.innerHTML = `<h3>${taluka}</h3><p>No data available.</p>`;
    return;
  }

  // Extract themes dynamically (excluding lat/lng keys)
  const themes = Object.keys(data).filter(key => key !== "lat" && key !== "lng");

  let html = `<h3>${taluka}</h3><ul>`;
  themes.forEach(theme => {
    html += `<li><strong>${theme}:</strong> ${data[theme]}</li>`;
  });
  html += `</ul>`;

  infoDiv.innerHTML = html;
}

// Initialize map on load
document.addEventListener('DOMContentLoaded', initMap);
