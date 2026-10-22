/* Mapa de eventos, pauta OFF y supermercados Cencosud.
 * Datos: data/eventos.json, data/pauta_off.json, data/cencosud.json
 * Mapa: Google Maps si hay clave en config.js; si no, Leaflet + teselas de CARTO/OpenStreetMap.
 */
(function () {
  "use strict";

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const RCOL = (r) => css("--r-" + r);
  const AMBA = [[-34.86, -58.85], [-34.38, -58.25]];
  const AR = [[-41.5, -70.5], [-28.5, -55.5]];
  const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const fmtKm = (d) => (d < 10 ? d.toFixed(1) : String(Math.round(d))).replace(".", ",") + " km";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hav = (a, b, c, d) => {
    const p = Math.PI / 180;
    const x = Math.sin(((c - a) * p) / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(((d - b) * p) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  };

  /* ---------------- Vista previa al pasar el mouse ---------------- */
  const PV = {
    event: (e) => `<div class="pv"><div class="pv-eb" style="color:${RCOL(e.rubro)}">${esc(e.rubro_nombre)}</div>
      <div class="pv-t">${esc(e.nombre)}</div><div class="pv-s">${esc(e.sede)}</div>
      <div class="pv-n"><b>${esc(e.convocatoria)}</b> <span>${esc(e.unidad)}</span></div>
      <div class="pv-s">Próxima edición: ${esc(e.proxima_edicion)}</div><div class="pv-h">Click para ver la ficha</div></div>`,
    ooh: (o) => `<div class="pv"><div class="pv-eb">Pauta OFF · zona de referencia</div>
      <div class="pv-t">${esc(o.zona)}</div><div class="pv-s">${esc(o.operador)}</div><div class="pv-s">${esc(o.formato)}</div></div>`,
    store: (s) => `<div class="pv"><div class="pv-eb" style="color:var(--cen)">${esc(s.cadena)} · Cencosud</div>
      <div class="pv-t">${esc(s.nombre)}</div><div class="pv-s">${esc(s.tipo)} · ${esc(s.provincia)}</div></div>`,
  };

  /* ---------------- Adaptador Google Maps ---------------- */
  function loadGoogle(key) {
    return new Promise((resolve, reject) => {
      window.__gmReady = () => resolve();
      window.gm_authFailure = () => reject(new Error("La clave de Google Maps fue rechazada."));
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&loading=async&callback=__gmReady&language=es&region=AR";
      s.async = true;
      s.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
      document.head.appendChild(s);
    });
  }

  const GSTYLE_LIGHT = [
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -100 }, { lightness: 20 }] },
    { featureType: "transit", elementType: "labels.icon", stylers: [{ saturation: -60 }] },
  ];
  const GSTYLE_DARK = [
    { elementType: "geometry", stylers: [{ color: "#1f2624" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#9aa6a1" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#141917" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e3733" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a4136" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#1b2a31" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a3330" }] },
  ];

  function googleAdapter(el) {
    const g = google.maps;
    const map = new g.Map(el, {
      center: { lat: -34.6, lng: -58.45 }, zoom: 11, mapTypeControl: false, streetViewControl: false,
      fullscreenControl: true, clickableIcons: false, styles: isDark() ? GSTYLE_DARK : GSTYLE_LIGHT,
    });
    const layers = { ev: [], ooh: [], cen: [], geoEv: [], geoCen: [] };
    let hl = [];
    const geoCircle = (lat, lon, km, col, op, w) => new g.Circle({ center: { lat, lng: lon }, radius: km * 1000, strokeColor: col, strokeOpacity: 0.55, strokeWeight: w, fillColor: col, fillOpacity: op, clickable: false, zIndex: 1 });
    const hover = new g.InfoWindow({ disableAutoPan: true, headerDisabled: true });
    let hoverTimer = null;
    const hoverable = (m, html, clickShows, lift) => {
      m.set("anchorPoint", new g.Point(0, -(lift || 8)));
      const show = () => {
        clearTimeout(hoverTimer);
        hover.setContent(html);
        hover.open({ map, anchor: m, shouldFocus: false });
      };
      m.addListener("mouseover", show);
      m.addListener("mouseout", () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => hover.close(), 150); });
      if (clickShows) m.addListener("click", show);
    };
    map.addListener("click", () => hover.close());
    const DIAMOND = "M 0,-7 7,0 0,7 -7,0 z";
    const api = {
      kind: "google",
      addEvent(e, onClick) {
        const m = new g.Marker({
          position: { lat: e.lat, lng: e.lon }, map, zIndex: 30,
          icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: RCOL(e.rubro), fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2.5 },
        });
        hoverable(m, PV.event(e), false, 12);
        m.addListener("click", () => { hover.close(); onClick(); });
        layers.ev.push({ id: e.id, m });
        layers.geoEv.push({ id: e.id, c: geoCircle(e.lat, e.lon, e.radio_km, RCOL(e.rubro), 0.07, 1) });
      },
      addOoh(o) {
        const m = new g.Marker({
          position: { lat: o.lat, lng: o.lon }, map, zIndex: 20,
          icon: { path: DIAMOND, scale: 1, fillColor: css("--ooh"), fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1.5 },
        });
        hoverable(m, PV.ooh(o), true, 9);
        layers.ooh.push({ m });
      },
      addStore(s) {
        const m = new g.Marker({
          position: { lat: s.lat, lng: s.lon }, map, zIndex: 10,
          icon: { path: g.SymbolPath.CIRCLE, scale: 4, fillColor: css("--cen"), fillOpacity: 0.95, strokeColor: "#ffffff", strokeWeight: 1 },
        });
        hoverable(m, PV.store(s), true, 6);
        layers.cen.push({ m });
        layers.geoCen.push({ c: geoCircle(s.lat, s.lon, 1, css("--cen"), 0.08, 0.8) });
      },
      showEvents(ids) { layers.ev.forEach((x) => x.m.setMap(ids.has(x.id) ? map : null)); },
      showLayer(name, on) { layers[name].forEach((x) => x.m.setMap(on ? map : null)); },
      showGeo(ids, stores) {
        layers.geoEv.forEach((x) => x.c.setMap(ids.has(x.id) ? map : null));
        layers.geoCen.forEach((x) => x.c.setMap(stores ? map : null));
      },
      highlight(e, oohs) {
        api.clearHighlight();
        hl.push(new g.Circle({ map, center: { lat: e.lat, lng: e.lon }, radius: e.radio_km * 1000, strokeColor: RCOL(e.rubro), strokeOpacity: 0.9, strokeWeight: 1.5, fillColor: RCOL(e.rubro), fillOpacity: 0.06, clickable: false }));
        oohs.forEach((o) => hl.push(new g.Polyline({ map, path: [{ lat: e.lat, lng: e.lon }, { lat: o.lat, lng: o.lon }], strokeOpacity: 0, clickable: false,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.6, strokeColor: css("--ooh"), scale: 2 }, offset: "0", repeat: "8px" }] })));
      },
      clearHighlight() { hl.forEach((x) => x.setMap(null)); hl = []; },
      fit(b, padRight) {
        const bounds = new g.LatLngBounds({ lat: b[0][0], lng: b[0][1] }, { lat: b[1][0], lng: b[1][1] });
        map.fitBounds(bounds, { top: 24, left: 24, bottom: 24, right: padRight || 24 });
      },
      restyle() { map.setOptions({ styles: isDark() ? GSTYLE_DARK : GSTYLE_LIGHT }); },
      note: "Mapa: Google Maps.",
    };
    return api;
  }

  /* ---------------- Adaptador Leaflet (respaldo) ---------------- */
  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = resolve; s.onerror = () => reject(new Error("No se pudo cargar el mapa."));
      document.head.appendChild(s);
    });
  }

  function leafletAdapter(el) {
    const map = L.map(el, { minZoom: 4, maxZoom: 18, zoomSnap: 0.5 });
    map.attributionControl.setPrefix(false);
    let tiles;
    const setTiles = () => {
      if (tiles) map.removeLayer(tiles);
      tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${isDark() ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, {
        subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap contributors © CARTO",
      }).addTo(map);
    };
    setTiles();
    map.createPane("geo").style.zIndex = 350; // debajo de los marcadores (overlayPane = 400)
    const groups = { ev: L.layerGroup().addTo(map), ooh: L.layerGroup().addTo(map), cen: L.layerGroup().addTo(map), geoEv: L.layerGroup(), geoCen: L.layerGroup() };
    const evm = {}, geom = {};
    const geoCircle = (lat, lon, km, col, op, w) => L.circle([lat, lon], { pane: "geo", radius: km * 1000, color: col, opacity: 0.55, weight: w, fillColor: col, fillOpacity: op, interactive: false });
    const hl = L.layerGroup().addTo(map);
    const api = {
      kind: "leaflet",
      addEvent(e, onClick) {
        const m = L.circleMarker([e.lat, e.lon], { radius: 8, weight: 2.5, color: "#fff", fillColor: RCOL(e.rubro), fillOpacity: 1 });
        m.bindTooltip(PV.event(e), { direction: "top", offset: [0, -8], className: "pv-tt" });
        m.on("click", onClick); evm[e.id] = m; groups.ev.addLayer(m);
        geom[e.id] = geoCircle(e.lat, e.lon, e.radio_km, RCOL(e.rubro), 0.07, 1);
      },
      addOoh(o) {
        const m = L.marker([o.lat, o.lon], { icon: L.divIcon({ className: "", html: '<div class="mk-ooh"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }), keyboard: false });
        m.bindTooltip(PV.ooh(o), { direction: "top", offset: [0, -8], className: "pv-tt" });
        groups.ooh.addLayer(m);
      },
      addStore(s) {
        const m = L.circleMarker([s.lat, s.lon], { radius: 3.5, weight: 1, color: "#fff", fillColor: css("--cen"), fillOpacity: 0.95 });
        m.bindTooltip(PV.store(s), { direction: "top", offset: [0, -4], className: "pv-tt" });
        groups.cen.addLayer(m);
        groups.geoCen.addLayer(geoCircle(s.lat, s.lon, 1, css("--cen"), 0.08, 0.8));
      },
      showEvents(ids) { groups.ev.clearLayers(); Object.entries(evm).forEach(([id, m]) => ids.has(id) && groups.ev.addLayer(m)); },
      showLayer(name, on) { on ? groups[name].addTo(map) : map.removeLayer(groups[name]); },
      showGeo(ids, stores) {
        groups.geoEv.clearLayers(); Object.entries(geom).forEach(([id, c]) => ids.has(id) && groups.geoEv.addLayer(c));
        groups.geoEv.addTo(map);
        api.showLayer("geoCen", stores);
      },
      highlight(e, oohs) {
        hl.clearLayers();
        L.circle([e.lat, e.lon], { radius: e.radio_km * 1000, color: RCOL(e.rubro), weight: 1.5, dashArray: "4 4", fillOpacity: 0.06, interactive: false }).addTo(hl);
        oohs.forEach((o) => L.polyline([[e.lat, e.lon], [o.lat, o.lon]], { color: css("--ooh"), weight: 1, opacity: 0.5, dashArray: "2 4", interactive: false }).addTo(hl));
      },
      clearHighlight() { hl.clearLayers(); },
      fit(b, padRight) { map.fitBounds(b, { paddingTopLeft: [24, 24], paddingBottomRight: [padRight || 24, 24], maxZoom: 15 }); },
      restyle() { setTiles(); },
      note: "Mapa de calles OpenStreetMap / CARTO. Configurá una clave en config.js para usar Google Maps.",
    };
    return api;
  }

  /* ---------------- App ---------------- */
  const state = { rubros: null, tris: null, ooh: true, cen: true, geo: false, sel: null };
  // Trimestre derivado de `inicio` (ISO); sin fecha → "sin"
  const triOf = (e) => (e.inicio ? e.inicio.slice(0, 4) + "-" + Math.ceil(+e.inicio.slice(5, 7) / 3) : "sin");
  const triName = (k) => (k === "sin" ? "Sin fecha" : `${k.slice(5)}.${/[13]$/.test(k) ? "er" : "º"} trim. ${k.slice(0, 4)}`);
  let D, M;
  const $ = (id) => document.getElementById(id);
  const card = $("card"), list = $("list");

  const padRight = () => (!card.hidden && window.innerWidth > 820 ? Math.min(430, $("map").clientWidth * 0.5) : 24);

  function boundsOf(e, oohs) {
    const pts = [[e.lat, e.lon], ...oohs.map((o) => [o.lat, o.lon])];
    const dLat = e.radio_km / 111, dLon = e.radio_km / (111 * Math.cos((e.lat * Math.PI) / 180));
    pts.push([e.lat - dLat, e.lon - dLon], [e.lat + dLat, e.lon + dLon]);
    const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
    return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
  }

  function visible(e) { return state.rubros.has(e.rubro) && state.tris.has(triOf(e)); }

  function render() {
    [...$("rubros").children].forEach((b) => b.setAttribute("aria-pressed", state.rubros.has(b.dataset.r)));
    [...$("tris").children].forEach((b) => b.setAttribute("aria-pressed", state.tris.has(b.dataset.t)));
    $("lyr-ooh").setAttribute("aria-pressed", state.ooh);
    $("lyr-cen").setAttribute("aria-pressed", state.cen);
    $("lyr-geo").setAttribute("aria-pressed", state.geo);
    $("lg-geo").hidden = !state.geo;
    M.showLayer("ooh", state.ooh);
    M.showLayer("cen", state.cen);
    const vis = D.eventos.filter(visible);
    const visIds = new Set(vis.map((e) => e.id));
    M.showEvents(visIds);
    M.showGeo(state.geo ? visIds : new Set(), state.geo && state.cen);
    const order = Object.keys(D.rubros);
    vis.sort((a, b) => order.indexOf(a.rubro) - order.indexOf(b.rubro));
    list.innerHTML = "";
    vis.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ev"; b.setAttribute("role", "listitem");
      if (state.sel === e.id) b.setAttribute("aria-current", "true");
      b.innerHTML = `<span class="bar" style="background:${RCOL(e.rubro)}"></span><span><span class="n">${esc(e.nombre)}</span><div class="m">${esc(e.proxima_edicion)} · ${esc(e.sede)}</div></span><span class="u">${esc(e.convocatoria)}</span>`;
      b.onclick = () => { select(e.id, true); if (window.innerWidth <= 820) document.querySelector(".mapwrap").scrollIntoView({ behavior: "smooth" }); };
      list.appendChild(b);
    });
    if (!vis.length) list.innerHTML = '<p style="padding:16px;color:var(--muted)">Ningún evento coincide con los filtros. Activá otro rubro o trimestre.</p>';
    if (state.sel && !vis.find((e) => e.id === state.sel)) closeCard();
    try { localStorage.setItem("evmap", JSON.stringify({ ooh: state.ooh, cen: state.cen, geo: state.geo, rubros: [...state.rubros], tris: [...state.tris] })); } catch (_) {}
  }

  function select(id, fit) {
    const e = D.eventos.find((x) => x.id === id);
    if (!e) return;
    state.sel = id;
    const oohs = e.pauta_off.map((k) => D.zonas.find((o) => o.id === k)).filter(Boolean);
    M.highlight(e, oohs);
    const dist = D.sucursales.map((s) => ({ s, d: hav(e.lat, e.lon, s.lat, s.lon) })).sort((a, b) => a.d - b.d);
    const inR = dist.filter((x) => x.d <= e.radio_km);
    const shown = (inR.length ? inR : dist).slice(0, inR.length ? 5 : 1);
    card.innerHTML = `<button class="x" type="button" aria-label="Cerrar ficha">×</button>
      <header><div class="eyebrow" style="color:${RCOL(e.rubro)}">${esc(e.rubro_nombre)}</div><h2>${esc(e.nombre)}</h2><div class="sub">${esc(e.sede)} · ubicación ${esc(e.precision)}</div></header>
      <div class="uni"><b>${esc(e.convocatoria)}</b><span class="pill c-${esc(e.confianza)}">Confianza ${esc(e.confianza.toLowerCase())}</span></div>
      <div class="unit">${esc(e.unidad)} · <a href="${esc(e.fuente)}" target="_blank" rel="noopener">fuente</a></div>
      <dl class="kv"><dt>Próxima edición</dt><dd>${esc(e.proxima_edicion)}</dd><dt>Trimestre</dt><dd>${esc(triName(triOf(e)))}${e.fecha_estimada ? " · fecha estimada" : ""}</dd></dl>
      <div class="sec"><h3><span class="mk-ooh" style="width:10px;height:10px"></span>Pauta OFF cercana</h3>${oohs.length ? "<ul>" + oohs.map((o) => `<li><span>${esc(o.zona)}<small>${esc(o.operador)} · ${esc(o.formato)}</small></span><a class="d" href="${esc(o.fuente)}" target="_blank" rel="noopener">fuente</a></li>`).join("") + "</ul>" : "<p>Sin zonas de vía pública relevadas.</p>"}${e.nota ? `<p style="margin-top:8px">${esc(e.nota)}</p>` : ""}</div>
      <div class="sec"><h3><span class="lg-cen" style="display:inline-block"></span>Cencosud ${inR.length ? `· ${inR.length} en ${e.radio_km} km` : `· ninguno en ${e.radio_km} km; el más cercano`}</h3><ul>${shown.map((x) => `<li><span>${esc(x.s.nombre)}<small>${esc(x.s.tipo)}</small></span><span class="d">${fmtKm(x.d)}</span></li>`).join("")}</ul></div>`;
    card.hidden = false;
    card.querySelector(".x").onclick = closeCard;
    if (fit) M.fit(boundsOf(e, oohs), padRight());
    render();
  }

  function closeCard() { state.sel = null; M.clearHighlight(); card.hidden = true; render(); }

  async function init() {
    const [ev, oo, ce] = await Promise.all(["data/eventos.json", "data/pauta_off.json", "data/cencosud.json"].map((u) => fetch(u).then((r) => r.json())));
    D = { rubros: ev.rubros, eventos: ev.eventos, zonas: oo.zonas, sucursales: ce.sucursales };
    $("asof").textContent = ev.actualizado.split("-").reverse().join("/");
    state.rubros = new Set(Object.keys(D.rubros));
    const tris = [...new Set(D.eventos.map(triOf))].sort((a, b) => (a === "sin") - (b === "sin") || a.localeCompare(b));
    state.tris = new Set(tris);
    try {
      const s = JSON.parse(localStorage.getItem("evmap") || "null");
      if (s) {
        state.ooh = s.ooh !== false; state.cen = s.cen !== false; state.geo = s.geo === true;
        if (Array.isArray(s.rubros) && s.rubros.length) state.rubros = new Set(s.rubros);
        const t = Array.isArray(s.tris) ? s.tris.filter((k) => tris.includes(k)) : [];
        if (t.length) state.tris = new Set(t);
      }
    } catch (_) {}
    $("stats").innerHTML = [[D.eventos.length, "eventos"], [D.zonas.length, "zonas de pauta OFF"], [D.sucursales.length, "sucursales Cencosud"]]
      .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

    const key = (window.MAP_CONFIG && window.MAP_CONFIG.GOOGLE_MAPS_API_KEY || "").trim();
    try {
      if (!key) throw new Error("sin clave");
      await loadGoogle(key);
      M = googleAdapter($("map"));
    } catch (err) {
      await loadLeaflet();
      M = leafletAdapter($("map"));
      if (key) M.note = err.message + " Se muestra OpenStreetMap.";
    }
    $("basenote").textContent = M.note;

    D.eventos.forEach((e) => M.addEvent(e, () => select(e.id, true)));
    D.zonas.forEach((o) => M.addOoh(o));
    D.sucursales.forEach((s) => M.addStore(s));

    Object.entries(D.rubros).forEach(([k, v]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.r = k;
      b.innerHTML = `<span class="sw" style="background:${RCOL(k)}"></span>${esc(v)}`;
      b.onclick = () => { state.rubros.has(k) && state.rubros.size > 1 ? state.rubros.delete(k) : state.rubros.add(k); render(); };
      $("rubros").appendChild(b);
    });
    tris.forEach((k) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.t = k;
      b.textContent = `${triName(k)} (${D.eventos.filter((e) => triOf(e) === k).length})`;
      b.onclick = () => { state.tris.has(k) && state.tris.size > 1 ? state.tris.delete(k) : state.tris.add(k); render(); };
      $("tris").appendChild(b);
    });
    $("lyr-ooh").onclick = () => { state.ooh = !state.ooh; render(); };
    $("lyr-cen").onclick = () => { state.cen = !state.cen; render(); };
    $("lyr-geo").onclick = () => { state.geo = !state.geo; render(); };
    $("v-amba").onclick = () => M.fit(AMBA, padRight());
    $("v-ar").onclick = () => M.fit(AR, padRight());
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !card.hidden) closeCard(); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => M.restyle());

    render();
    M.fit(AMBA, 24);
    select("lolla", true);
  }

  init().catch((err) => {
    $("basenote").textContent = "No se pudieron cargar los datos: " + err.message;
  });
})();
