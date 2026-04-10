import cors from "cors";
import express from "express";
import { incidentsRouter } from "./routes/incidents.js";
import { analyticsRouter } from "./routes/analytics.js";
import { moderationRouter } from "./routes/moderation.js";
import { authContextMiddleware } from "./middleware/auth.js";
export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "1mb" }));
    app.use(authContextMiddleware);
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/", (_req, res) => {
        res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>CrisisWorld Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
    />
    <style>
      :root {
        --bg: #f2f6f4;
        --paper: #ffffff;
        --ink: #152429;
        --muted: #5a6c71;
        --mint: #0f766e;
        --amber: #d97706;
        --rose: #be123c;
        --line: #d6e3de;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 0% 0%, #e5fff2 0%, transparent 34%),
          radial-gradient(circle at 100% 100%, #fff3de 0%, transparent 30%),
          linear-gradient(180deg, #edf4f1 0%, var(--bg) 100%);
        color: var(--ink);
      }
      .page {
        width: 100vw;
        min-height: 100vh;
        margin: 0;
        padding: 0;
      }
      .hero {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 14px;
        margin: 16px 16px 0;
      }
      .title {
        font-family: "Space Grotesk", sans-serif;
        margin: 0;
        font-size: clamp(1.6rem, 3vw, 2.3rem);
      }
      .subtitle {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 0.95rem;
      }
      .filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      select, button {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 8px 10px;
        background: #fbfefc;
        color: var(--ink);
        font-weight: 600;
      }
      button {
        background: linear-gradient(120deg, var(--mint), #14b8a6);
        border: none;
        color: white;
        cursor: pointer;
      }
      .stats {
        margin: 12px 16px 0;
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .stat {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px;
      }
      .stat .k {
        color: var(--muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .stat .v {
        margin-top: 6px;
        font-family: "Space Grotesk", sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
      }
      .layout {
        margin-top: 12px;
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr;
      }
      .panel {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .panel-h {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .panel-h h2 {
        margin: 0;
        font-size: 1rem;
        font-family: "Space Grotesk", sans-serif;
      }
      #map {
        height: min(74vh, 840px);
        width: 100%;
      }
      .map-panel {
        width: 100vw;
        margin-left: calc(50% - 50vw);
        margin-right: calc(50% - 50vw);
        border-radius: 0;
        border-left: none;
        border-right: none;
      }
      .map-panel .panel-h {
        padding-left: 16px;
        padding-right: 16px;
      }
      .timeline {
        border-top: 1px solid var(--line);
        padding: 10px 16px 12px;
        background: #f8fbfa;
      }
      .timeline-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .preset-btn {
        background: #eef5f3;
        color: var(--ink);
        border: 1px solid var(--line);
        padding: 5px 9px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 0.78rem;
      }
      .preset-btn.active {
        background: #d9f7ef;
        border-color: #95dbc7;
      }
      .timeline input[type="range"] {
        width: min(760px, 100%);
      }
      .timeline-meta {
        font-size: 0.8rem;
        color: var(--muted);
      }
      .side {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr 1fr;
        margin: 0 16px 16px;
      }
      .drawer {
        padding: 12px;
      }
      .drawer h3 {
        margin: 0 0 8px;
        font-family: "Space Grotesk", sans-serif;
        font-size: 1rem;
      }
      .drawer p {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 0.86rem;
      }
      .drawer .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
      }
      .drawer .cell {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 8px;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.84rem;
        color: var(--muted);
      }
      #trend {
        height: 160px;
        padding: 12px;
      }
      .trend-svg {
        width: 100%;
        height: 100%;
      }
      .feed {
        max-height: 44vh;
        overflow: auto;
        padding: 10px;
        display: grid;
        gap: 8px;
      }
      .incident {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px;
        background: #fcfffd;
      }
      .incident h3 {
        margin: 0 0 4px;
        font-size: 0.9rem;
      }
      .meta {
        color: var(--muted);
        font-size: 0.78rem;
      }
      .chip {
        display: inline-block;
        margin-top: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
      }
      .pending { background: #fff7ed; color: #9a3412; }
      .verified { background: #ecfdf5; color: #065f46; }
      .rejected { background: #fff1f2; color: #9f1239; }
      .status { color: var(--muted); font-size: 0.85rem; }
      @media (max-width: 980px) {
        .layout { grid-template-columns: 1fr; }
        .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .side { grid-template-columns: 1fr; }
        #map { height: 56vh; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div>
          <h1 class="title">Global Security Intelligence Dashboard</h1>
          <p class="subtitle">Map-first monitoring for incidents, trend shifts, and verification state.</p>
        </div>
        <div class="filters">
          <select id="countryFilter">
            <option value="">All Countries</option>
          </select>
          <select id="statusFilter">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <button id="refresh">Refresh</button>
          <label class="toggle"><input type="checkbox" id="clusterToggle" checked />Clusters</label>
          <label class="toggle"><input type="checkbox" id="heatToggle" checked />Heatmap</label>
        </div>
      </section>

      <section class="stats">
        <article class="stat"><div class="k">Incidents</div><div class="v" id="incidentsCount">0</div></article>
        <article class="stat"><div class="k">Killed</div><div class="v" id="killedCount">0</div></article>
        <article class="stat"><div class="k">Injured</div><div class="v" id="injuredCount">0</div></article>
        <article class="stat"><div class="k">Top Country</div><div class="v" id="topCountry">-</div></article>
      </section>

      <div class="layout">
        <section class="panel map-panel">
          <div class="panel-h">
            <h2>Global Incident Map</h2>
            <span class="status" id="status">Loading...</span>
          </div>
          <div id="map"></div>
          <div class="timeline">
            <div class="timeline-row">
              <button id="playTimeline">Play</button>
              <button id="jumpLatest">Latest</button>
              <select id="playbackSpeed">
                <option value="900">0.5x</option>
                <option value="550" selected>1x</option>
                <option value="250">2x</option>
              </select>
              <label class="toggle"><input type="checkbox" id="autoFitToggle" checked />Auto-fit</label>
              <input type="range" id="timelineRange" min="0" max="0" value="0" step="1" />
              <strong id="timelineCurrent">-</strong>
            </div>
            <div class="timeline-row">
              <button class="preset-btn active" data-window="all">All</button>
              <button class="preset-btn" data-window="7">7D</button>
              <button class="preset-btn" data-window="30">30D</button>
              <button class="preset-btn" data-window="365">1Y</button>
            </div>
            <div class="timeline-row timeline-meta">
              <span id="timelineStart">-</span>
              <span>to</span>
              <span id="timelineEnd">-</span>
              <span>| Visible incidents: <strong id="timelineVisible">0</strong></span>
            </div>
          </div>
        </section>

        <section class="side">
          <section class="panel">
            <div class="panel-h"><h2>Incidents Over Time</h2></div>
            <div id="trend"></div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Top Countries</h2></div>
            <div id="countries" style="padding: 10px;"></div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Live Incident Feed</h2></div>
            <div class="feed" id="feed"></div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Incident Detail</h2></div>
            <div class="drawer" id="drawer"></div>
          </section>
        </section>
      </div>
    </div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script src="https://unpkg.com/leaflet.heat/dist/leaflet-heat.js"></script>
    <script>
      const byId = (id) => document.getElementById(id);
      const state = {
        incidents: [],
        countries: [],
        byId: new Map(),
        selectedIncidentId: null,
        timelineDays: [],
        playbackTimer: null,
        windowDays: null
      };
      let map;
      let markerLayer;
      let heatLayer;
      let plainLayer;

      function formatDay(ts) {
        return new Date(ts).toISOString().slice(0, 10);
      }

      async function getJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(url + " -> " + response.status + " " + text);
        }
        return response.json();
      }

      function initMap() {
        map = L.map("map", { worldCopyJump: true, minZoom: 2 }).setView([18, 10], 2);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
          subdomains: "abcd",
          referrerPolicy: "strict-origin-when-cross-origin",
          attribution:
            '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);
        markerLayer = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true
        });
        plainLayer = L.layerGroup();
      }

      function colorForStatus(status) {
        if (status === "verified") return "#0f766e";
        if (status === "rejected") return "#be123c";
        return "#d97706";
      }

      function markerSize(incident) {
        return Math.max(10, Math.min(28, 10 + Number(incident.killed_count || 0)));
      }

      function setDrawer(incident) {
        const root = byId("drawer");
        if (!incident) {
          root.innerHTML = '<p>Select an incident from the map or feed.</p>';
          return;
        }

        root.innerHTML =
          '<h3>' + incident.title + '</h3>' +
          '<p>' + (incident.country_name || 'Unknown') + ' | ' + (incident.city_name || 'n/a') + '</p>' +
          '<p>' + (incident.incident_category || 'uncategorized') + '</p>' +
          '<p>' + new Date(incident.occurred_at).toLocaleString() + '</p>' +
          '<div class="row">' +
            '<div class="cell"><strong>Killed</strong><br />' + Number(incident.killed_count || 0) + '</div>' +
            '<div class="cell"><strong>Injured</strong><br />' + Number(incident.injured_count || 0) + '</div>' +
          '</div>' +
          '<div class="row">' +
            '<div class="cell"><strong>Status</strong><br />' + (incident.verification_status || 'pending') + '</div>' +
            '<div class="cell"><strong>Coords</strong><br />' + Number(incident.latitude).toFixed(3) + ', ' + Number(incident.longitude).toFixed(3) + '</div>' +
          '</div>';
      }

      function updateMap(incidents) {
        markerLayer.clearLayers();
        plainLayer.clearLayers();
        if (heatLayer) {
          map.removeLayer(heatLayer);
          heatLayer = null;
        }

        const useClusters = byId("clusterToggle").checked;
        const useHeat = byId("heatToggle").checked;
        const heatPoints = [];

        incidents.forEach((incident) => {
          const color = colorForStatus(incident.verification_status);
          const size = markerSize(incident);
          const marker = L.marker([incident.latitude, incident.longitude], {
            icon: L.divIcon({
              className: "",
              html:
                '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:' + color + ';opacity:.45;border:2px solid ' + color + ';"></div>',
              iconSize: [size, size],
              iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)]
            })
          });

          marker.bindPopup(
            "<strong>" + incident.title + "</strong><br/>" +
              incident.country_name + " | " + (incident.city_name || "n/a") + "<br/>" +
              "Killed: " + incident.killed_count + " | Injured: " + incident.injured_count + "<br/>" +
              "Status: " + incident.verification_status
          );
          marker.on("click", () => {
            state.selectedIncidentId = incident.id;
            setDrawer(incident);
          });

          heatPoints.push([Number(incident.latitude), Number(incident.longitude), Math.max(0.1, Number(incident.killed_count || 0) + 0.3)]);

          if (useClusters) {
            markerLayer.addLayer(marker);
          } else {
            plainLayer.addLayer(marker);
          }
        });

        if (useClusters) {
          map.addLayer(markerLayer);
          if (map.hasLayer(plainLayer)) {
            map.removeLayer(plainLayer);
          }
        } else {
          map.addLayer(plainLayer);
          if (map.hasLayer(markerLayer)) {
            map.removeLayer(markerLayer);
          }
        }

        if (useHeat && heatPoints.length) {
          heatLayer = L.heatLayer(heatPoints, {
            radius: 20,
            blur: 15,
            minOpacity: 0.25,
            maxZoom: 7,
            gradient: { 0.25: "#fde68a", 0.55: "#f59e0b", 0.8: "#ef4444", 1: "#7f1d1d" }
          }).addTo(map);
        }
      }

      function renderCountries(countries) {
        const root = byId("countries");
        if (!countries.length) {
          root.innerHTML = '<div class="status">No country data available.</div>';
          return;
        }
        root.innerHTML = countries
          .slice(0, 6)
          .map((c) =>
            '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #d6e3de;">' +
              '<span>' + c.country_name + '</span><strong>' + c.incident_count + '</strong>' +
            '</div>'
          )
          .join("");
      }

      function summarizeCountries(incidents) {
        const mapCount = new Map();
        incidents.forEach((i) => {
          const key = i.country_name || "Unknown";
          mapCount.set(key, (mapCount.get(key) || 0) + 1);
        });
        return Array.from(mapCount.entries())
          .map(([country_name, incident_count]) => ({ country_name, incident_count }))
          .sort((a, b) => b.incident_count - a.incident_count);
      }

      function renderFeed(incidents) {
        const root = byId("feed");
        if (!incidents.length) {
          root.innerHTML = '<div class="status">No incidents for current filter.</div>';
          return;
        }
        root.innerHTML = incidents.slice(0, 20).map((item) => {
          return '<article class="incident">' +
            '<h3>' + item.title + '</h3>' +
            '<div class="meta">' + item.country_name + ' | ' + (item.city_name || 'n/a') + '</div>' +
            '<div class="meta">Killed ' + item.killed_count + ' | Injured ' + item.injured_count + '</div>' +
            '<span class="chip ' + item.verification_status + '">' + item.verification_status + '</span>' +
          '</article>';
        }).join('');

        root.querySelectorAll('.incident').forEach((el, index) => {
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => {
            const incident = incidents[index];
            state.selectedIncidentId = incident.id;
            setDrawer(incident);
            map.panTo([incident.latitude, incident.longitude], { animate: true, duration: 0.8 });
          });
        });
      }

      function renderTrend(timeseries) {
        const root = byId("trend");
        if (!timeseries.length) {
          root.innerHTML = '<div class="status" style="padding:10px;">No timeseries data.</div>';
          return;
        }

        const values = timeseries.map((d) => Number(d.incident_count || 0));
        const maxValue = Math.max(...values, 1);
        const width = 420;
        const height = 130;
        const step = width / Math.max(values.length - 1, 1);
        const points = values
          .map((value, index) => {
            const x = index * step;
            const y = height - (value / maxValue) * (height - 14) - 7;
            return x + "," + y;
          })
          .join(" ");

        root.innerHTML =
          '<svg class="trend-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
          '<polyline points="' + points + '" fill="none" stroke="#0f766e" stroke-width="3" stroke-linecap="round" />' +
          '</svg>';
      }

      function summarizeTimeseries(incidents) {
        const dayMap = new Map();
        incidents.forEach((i) => {
          const day = new Date(i.occurred_at).toISOString().slice(0, 10);
          dayMap.set(day, (dayMap.get(day) || 0) + 1);
        });
        return Array.from(dayMap.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([bucket, incident_count]) => ({ bucket, incident_count }));
      }

      function renderStats(incidents, countries) {
        const killed = incidents.reduce((acc, i) => acc + Number(i.killed_count || 0), 0);
        const injured = incidents.reduce((acc, i) => acc + Number(i.injured_count || 0), 0);
        byId("incidentsCount").textContent = String(incidents.length);
        byId("killedCount").textContent = String(killed);
        byId("injuredCount").textContent = String(injured);
        byId("topCountry").textContent = countries[0] ? countries[0].country_name : "-";
      }

      function updateCountryFilter(incidents) {
        const select = byId("countryFilter");
        const existing = new Set(Array.from(select.options).map((o) => o.value));
        const options = Array.from(new Set(incidents.map((i) => i.countryCode || i.country_code))).filter(Boolean).sort();
        options.forEach((code) => {
          if (existing.has(code)) {
            return;
          }
          const option = document.createElement("option");
          option.value = code;
          option.textContent = code;
          select.appendChild(option);
        });
      }

      function stopTimelinePlayback() {
        if (state.playbackTimer) {
          clearInterval(state.playbackTimer);
          state.playbackTimer = null;
        }
        byId("playTimeline").textContent = "Play";
      }

      function setActivePreset(windowValue) {
        document.querySelectorAll('.preset-btn').forEach((button) => {
          const isActive = button.getAttribute('data-window') === windowValue;
          if (isActive) {
            button.classList.add('active');
          } else {
            button.classList.remove('active');
          }
        });
      }

      function buildTimeline(incidents) {
        const unique = Array.from(
          new Set(
            incidents.map((i) => {
              const d = new Date(i.occurred_at);
              d.setUTCHours(0, 0, 0, 0);
              return d.getTime();
            })
          )
        ).sort((a, b) => a - b);

        state.timelineDays = unique;

        const slider = byId("timelineRange");
        slider.max = String(Math.max(unique.length - 1, 0));
        slider.value = String(Math.max(unique.length - 1, 0));
        slider.disabled = unique.length <= 1;

        byId("timelineStart").textContent = unique.length ? formatDay(unique[0]) : "-";
        byId("timelineEnd").textContent = unique.length ? formatDay(unique[unique.length - 1]) : "-";
      }

      function incidentsAtTimeline() {
        if (!state.timelineDays.length) {
          return [];
        }
        const idx = Number(byId("timelineRange").value || "0");
        const cutoff = state.timelineDays[idx] + 86400000;
        byId("timelineCurrent").textContent = formatDay(state.timelineDays[idx]);
        const floor =
          typeof state.windowDays === "number"
            ? state.timelineDays[idx] - state.windowDays * 24 * 60 * 60 * 1000
            : Number.NEGATIVE_INFINITY;

        return state.incidents.filter((i) => {
          const ts = new Date(i.occurred_at).getTime();
          return ts < cutoff && ts >= floor;
        });
      }

      function fitMapToIncidents(incidents) {
        if (!byId("autoFitToggle").checked || incidents.length === 0) {
          return;
        }

        const bounds = L.latLngBounds(
          incidents.map((incident) => [Number(incident.latitude), Number(incident.longitude)])
        );
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12), { animate: true, duration: 0.4, maxZoom: 6 });
        }
      }

      function rerenderFromTimeline() {
        const visibleIncidents = incidentsAtTimeline();
        const visibleCountries = summarizeCountries(visibleIncidents);
        const visibleTimeseries = summarizeTimeseries(visibleIncidents);
        byId("timelineVisible").textContent = String(visibleIncidents.length);

        renderStats(visibleIncidents, visibleCountries);
        updateMap(visibleIncidents);
        renderFeed(visibleIncidents);
        renderCountries(visibleCountries);
        renderTrend(visibleTimeseries);
        fitMapToIncidents(visibleIncidents);

        if (!state.selectedIncidentId && visibleIncidents.length) {
          state.selectedIncidentId = visibleIncidents[0].id;
        }
        const selectedIncident = state.byId.get(state.selectedIncidentId);
        if (selectedIncident && visibleIncidents.some((i) => i.id === selectedIncident.id)) {
          setDrawer(selectedIncident);
        } else {
          setDrawer(null);
        }
      }

      function toggleTimelinePlayback() {
        if (state.playbackTimer) {
          stopTimelinePlayback();
          return;
        }

        const slider = byId("timelineRange");
        if (Number(slider.value) >= Number(slider.max)) {
          slider.value = "0";
          rerenderFromTimeline();
        }

        byId("playTimeline").textContent = "Pause";
        const intervalMs = Number(byId("playbackSpeed").value || "550");
        state.playbackTimer = setInterval(() => {
          const next = Number(slider.value) + 1;
          if (next > Number(slider.max)) {
            stopTimelinePlayback();
            return;
          }
          slider.value = String(next);
          rerenderFromTimeline();
        }, intervalMs);
      }

      async function refresh() {
        const status = byId("status");
        status.textContent = "Refreshing data...";
        try {
          stopTimelinePlayback();
          const countryCode = byId("countryFilter").value;
          const verificationStatus = byId("statusFilter").value;

          const params = new URLSearchParams({ limit: "2000" });
          if (countryCode) params.set("countryCode", countryCode);
          if (verificationStatus) params.set("verificationStatus", verificationStatus);

          const incidents = await getJson("/api/incidents?" + params.toString());

          state.incidents = incidents.data;
          state.countries = summarizeCountries(incidents.data);
          state.byId = new Map(incidents.data.map((incident) => [incident.id, incident]));

          updateCountryFilter(incidents.data);
          buildTimeline(incidents.data);
          state.windowDays = null;
          setActivePreset("all");
          rerenderFromTimeline();

          status.textContent = "Live.";
        } catch (error) {
          status.textContent = "Refresh failed: " + error.message;
        }
      }

      byId("refresh").addEventListener("click", refresh);
      byId("countryFilter").addEventListener("change", refresh);
      byId("statusFilter").addEventListener("change", refresh);
      byId("clusterToggle").addEventListener("change", rerenderFromTimeline);
      byId("heatToggle").addEventListener("change", rerenderFromTimeline);
      byId("timelineRange").addEventListener("input", () => {
        stopTimelinePlayback();
        rerenderFromTimeline();
      });
      byId("playTimeline").addEventListener("click", toggleTimelinePlayback);
      byId("jumpLatest").addEventListener("click", () => {
        stopTimelinePlayback();
        const slider = byId("timelineRange");
        slider.value = String(slider.max);
        rerenderFromTimeline();
      });

      document.querySelectorAll('.preset-btn').forEach((button) => {
        button.addEventListener('click', () => {
          stopTimelinePlayback();
          const raw = button.getAttribute('data-window') || 'all';
          state.windowDays = raw === 'all' ? null : Number(raw);
          setActivePreset(raw);
          rerenderFromTimeline();
        });
      });

      byId("playbackSpeed").addEventListener("change", () => {
        if (state.playbackTimer) {
          stopTimelinePlayback();
          toggleTimelinePlayback();
        }
      });

      byId("autoFitToggle").addEventListener("change", rerenderFromTimeline);
      initMap();
      setDrawer(null);
      refresh();
    </script>
  </body>
</html>`);
    });
    app.use("/api/incidents", incidentsRouter);
    app.use("/api/analytics", analyticsRouter);
    app.use("/api/moderation", moderationRouter);
    app.use((err, _req, res, _next) => {
        const message = err instanceof Error ? err.message : "Unexpected server error";
        res.status(500).json({ error: message });
    });
    return app;
}
