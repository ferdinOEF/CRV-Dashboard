// script.js - Goa Climate Risk Dashboard
// Expects /riskData.json to be available (put in /public/ on Vercel).

document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map').setView([15.36, 74.02], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // DOM
  const status = document.getElementById('status');
  const infoContent = document.getElementById('info-content');
  const themeSelect = document.getElementById('themeSelect');
  const heatToggle = document.getElementById('heatToggle');

  let dataset = null;
  let rows = [];              // flattened taluka rows
  let markers = [];           // leaflet marker references
  let heatLayer = null;
  let currentTheme = 'All';

  // fallback coords for talukas if JSON missing
  const FALLBACK = {
    "Pernem":[15.715,73.795],"Bardez":[15.553,73.80],"Tiswadi":[15.50,73.83],
    "Bicholim":[15.60,73.95],"Sattari":[15.55,74.05],"Ponda":[15.408,74.014],
    "Mormugao":[15.389,73.815],"Salcete":[15.30,73.957],"Quepem":[15.228,74.070],
    "Sanguem":[15.24,74.165],"Dharbandora":[15.322,74.183],"Canacona":[15.018,74.023]
  };

  // Utilities
  function logStatus(msg, isErr=false){
    status.textContent = msg;
    if(isErr) status.style.color = '#b00020';
    else status.style.color = '';
    console.log('STATUS:', msg);
  }
  function escapeHTML(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // load dataset (absolute path)
  async function loadData(){
    try{
      logStatus('Loading /riskData.json...');
      const res = await fetch('/riskData.json', {cache: 'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      dataset = await res.json();
      logStatus('Loaded riskData.json — parsing...');
      rows = flatten(dataset);
      populateThemes(rows);
      render();
      logStatus('Ready. Click a taluka marker.');
    }catch(err){
      console.error(err);
      logStatus(`Failed to load /riskData.json — check /public/ and filename. (${err.message})`, true);
      infoContent.innerHTML = `<div style="color:#b00020">Error loading data. Open DevTools Console for details. Also test: <a href="/riskData.json" target="_blank">/riskData.json</a></div>`;
    }
  }

  function flatten(data){
    const out = [];
    Object.entries(data).forEach(([district, talukas])=>{
      Object.entries(talukas).forEach(([talukaName, obj])=>{
        let lat,lng;
        if(Array.isArray(obj.location) && obj.location.length===2){ [lat,lng] = obj.location; }
        else if(typeof obj.lat==='number' && typeof obj.lng==='number'){ lat = obj.lat; lng = obj.lng; }
        else if(FALLBACK[talukaName]){ [lat,lng] = FALLBACK[talukaName]; }
        else { console.warn('No coords for', talukaName); return; }

        // risks stored under "risks" per our JSON convention
        const risks = obj.risks || obj.themes || {};
        out.push({ district, taluka: talukaName, lat, lng, risks });
      });
    });
    return out;
  }

  function collectThemes(rows){
    const s = new Set();
    rows.forEach(r => Object.keys(r.risks || {}).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }

  function populateThemes(rows){
    const themes = collectThemes(rows);
    // clear existing except All
    themeSelect.innerHTML = '<option value="All">All Themes</option>';
    themes.forEach(t => {
      const opt = document.createElement('option'); opt.value = t; opt.textContent = t.replaceAll('_',' & ');
      themeSelect.appendChild(opt);
    });
  }

  // compute intensity score for taluka (for heat/marker size)
  function talukaScore(risks, theme){
    // risks can be either object of themes where each theme is object with "level" or array of strings
    if(!risks) return 0;
    if(theme && theme !== 'All'){
      const v = risks[theme];
      if(!v) return 0;
      if(Array.isArray(v)) return v.length;
      if(typeof v === 'object') return levelWeight(v.level || 'Statewide concern');
      return 0;
    }
    // All themes => sum weights
    return Object.values(risks).reduce((sum,v)=>{
      if(Array.isArray(v)) return sum + v.length;
      if(typeof v==='object') return sum + levelWeight(v.level);
      return sum;
    },0);
  }

  function levelWeight(level){
    if(!level) return 1;
    const l = String(level).toLowerCase();
    if(l==='high') return 3;
    if(l==='medium') return 2;
    if(l==='low') return 1;
    if(l.includes('state')) return 1.5;
    return 1;
  }

  function render(){
    // clear markers & heat
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if(heatLayer){ map.removeLayer(heatLayer); heatLayer = null; }

    // intensities
    const vals = rows.map(r => talukaScore(r.risks, currentTheme));
    const min = Math.min(...vals); const max = Math.max(...vals);

    // create markers and heatpoints
    const heatPoints = [];
    rows.forEach((r, idx)=>{
      const raw = vals[idx] || 0;
      const score = normalize(raw, min, max);
      const color = scoreColor(score);

      // create marker
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 8 + Math.round(score*8),
        color: '#222',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindPopup(`<strong>${escapeHTML(r.taluka)}</strong><br/><small>${escapeHTML(r.district)}</small>`);
      marker.on('click', ()=> { renderInfo(r); });

      markers.push(marker);
      heatPoints.push([r.lat, r.lng, score || 0.0001]);
    });

    // heat
    if(heatToggle.checked && typeof L.heatLayer === 'function'){
      heatLayer = L.heatLayer(heatPoints, { radius: 28, blur: 18, maxZoom: 12 }).addTo(map);
    }
  }

  function normalize(v, min, max){
    if(max===min) return (max===0?0:1);
    return Math.max(0, Math.min(1, (v-min)/(max-min)));
  }

  function scoreColor(s){
    if(s >= 0.75) return '#c1121f';
    if(s >= 0.5) return '#f28415';
    if(s > 0) return '#ffd166';
    return '#7cb342';
  }

  function renderInfo(row){
    const { taluka, district, risks } = row;
    let html = `<h2>${escapeHTML(taluka)}</h2><div class="muted">${escapeHTML(district)}</div>`;

    if(!risks || Object.keys(risks).length===0){
      html += `<div class="muted">No thematic risks listed.</div>`;
      infoContent.innerHTML = html; return;
    }

    // If theme filter selected, show only that
    if(currentTheme !== 'All'){
      html += accordionBlock(currentTheme, risks[currentTheme]);
    } else {
      Object.entries(risks).forEach(([themeKey, value]) => { html += accordionBlock(themeKey, value); });
    }
    infoContent.innerHTML = html;
    wireAccordions();
  }

  function accordionBlock(title, value){
    const id = 'acc-' + Math.random().toString(36).slice(2,9);
    const displayTitle = escapeHTML(title.replaceAll('_',' & '));
    let badge = '';
    let listHtml = '';

    // value could be array or object
    if(Array.isArray(value)){
      listHtml = value.map(v => `<li>${escapeHTML(v)}</li>`).join('');
    } else if(value && typeof value === 'object'){
      const lvl = (value.level || '').toLowerCase();
      const cls = lvl==='high' ? 'high' : (lvl==='medium' ? 'medium' : (lvl==='low' ? 'low' : 'state'));
      badge = value.level ? `<span class="badge ${cls}">${escapeHTML(value.level)}</span>` : '';
      if(value.description) listHtml += `<li>${escapeHTML(value.description)}</li>`;
      if(value.evidence) listHtml += `<li style="font-style:italic;color:#475569">${escapeHTML(value.evidence)}</li>`;
      if(value.source_tag) listHtml += `<li class="muted">Source: ${escapeHTML(value.source_tag)}</li>`;
    } else {
      listHtml = `<li class="muted">No details</li>`;
    }

    return `
      <div class="accordion">
        <div class="accordion-header" data-target="${id}">
          <span>${displayTitle}${badge}</span>
          <span class="toggle">+</span>
        </div>
        <div id="${id}" class="accordion-content"><ul class="risk-list">${listHtml}</ul></div>
      </div>
    `;
  }

  function wireAccordions(){
    document.querySelectorAll('.accordion-header').forEach(h=>{
      h.addEventListener('click', ()=>{
        const id = h.getAttribute('data-target');
        const content = document.getElementById(id);
        const toggle = h.querySelector('.toggle');
        if(content.style.display === 'block'){ content.style.display = 'none'; toggle.textContent = '+'; }
        else { content.style.display = 'block'; toggle.textContent = '–'; }
      });
    });
  }

  // events
  themeSelect.addEventListener('change', (e) => { currentTheme = e.target.value; render(); infoContent.innerHTML = `<div class="muted">Select a taluka marker to view "${currentTheme}" risks.</div>`; });
  heatToggle.addEventListener('change', () => { render(); });

  // small helper to list themes in panel
  function listUniqueThemes(rows){
    return collectThemes(rows);
    function collectThemes(rs){
      const s = new Set();
      rs.forEach(r => Object.keys(r.risks || {}).forEach(t => s.add(t)));
      return Array.from(s).sort();
    }
  }

  // load
  loadData();
});
