import 'leaflet/dist/leaflet.css';
import './viewer.css';
import L from 'leaflet';
import proj4 from 'proj4';
import { createIcons, Menu, Mountain, Crop, Download, RefreshCw, X, CodeXml, ExternalLink, Crosshair } from 'lucide';
import { interpolateViridis, interpolateMagma, interpolateYlGn, interpolateRdBu, interpolateRainbow, interpolateTurbo } from 'd3-scale-chromatic';
import { AREAS, BASE_URL, exportPreview, LAYERS, validateBounds } from './raster.js';

const byId = (id) => document.getElementById(id);
document.querySelector('#app').innerHTML = `
  <header class="app-header">
    <button id="menu" class="icon-button mobile-only" title="Layers and settings" aria-label="Layers and settings" aria-expanded="false"><i data-lucide="menu"></i></button>
    <div class="brand"><i data-lucide="mountain"></i><div><h1>WERK</h1><span>California LiDAR</span></div></div>
    <span class="resolution">30 m source data</span>
    <a class="icon-button" href="https://github.com/neilSchroeder/nasa-werk-viewer" target="_blank" rel="noopener" title="Project on GitHub" aria-label="Project on GitHub"><i data-lucide="code-xml"></i></a>
  </header>
  <div class="workspace">
    <aside id="sidebar" aria-label="Layers and settings">
      <div class="sidebar-heading"><h2>Layers</h2><button id="close-sidebar" class="icon-button mobile-only" title="Close settings" aria-label="Close settings"><i data-lucide="x"></i></button></div>
      <label for="product">Product</label><select id="product">${LAYERS.map((layer) => `<option value="${layer.code}">${layer.label}</option>`).join('')}</select>
      <label for="area">Area</label><select id="area">${Object.keys(AREAS).map((area) => `<option>${area}</option>`).join('')}<option>Custom bounds</option></select>
      <button id="custom-open" class="text-button" hidden><i data-lucide="crop"></i> Edit bounds</button>
      <section class="settings"><h2>Display</h2>
        <label for="edge">Preview pixels / longest edge</label><select id="edge"><option>256</option><option>512</option><option selected>768</option><option>1024</option></select>
        <label for="opacity">Layer opacity <output id="opacity-value">85%</output></label><input id="opacity" type="range" min="0" max="100" step="5" value="85">
        <label for="stretch">Color range</label><select id="stretch"><option value="robust">2-98 percentile</option><option value="full">Full range</option></select>
        <label class="check-label"><input id="lock-scale" type="checkbox"> Lock color range</label>
        <label for="basemap">Basemap</label><select id="basemap"><option value="osm">OpenStreetMap</option><option value="none">None</option></select>
      </section>
      <details class="quality"><summary>Source and quality</summary>
        <p>NASA WERK / SDSC. Data license: CC0-1.0.</p>
        <p>Fill values near -9999 are missing. Negative canopy heights are masked. Positive source outliers remain.</p>
        <p>Canopy previews use native pixels, bypassing corrupted overviews. Wide requests are limited by browser memory.</p>
        <p>Units follow the publisher's examples. Vertical datum, aspect direction, and statistical conventions remain undocumented.</p>
        <p>Survey dates vary by campaign. Acquisition year is not a time series.</p>
        <a href="${BASE_URL}/README" target="_blank" rel="noopener">Publisher README <i data-lucide="external-link"></i></a>
        <a href="https://github.com/neilSchroeder/nasa-werk-viewer/blob/main/docs/variable-units.md" target="_blank" rel="noopener">Unit references <i data-lucide="external-link"></i></a>
      </details>
      <footer class="sidebar-footer">A personal project by Neil Schroeder.<br>Not an official NASA product.</footer>
    </aside>
    <main>
      <div class="map-toolbar"><div class="view-heading"><h2 id="view-title">Canopy height</h2><span id="view-unit">m</span></div>
        <div class="map-actions"><button id="load" class="text-button primary" title="Read raster for the visible map extent"><i data-lucide="crop"></i><span>Load extent</span></button>
          <button id="reset" class="icon-button" title="Reset to selected area" aria-label="Reset to selected area"><i data-lucide="refresh-cw"></i></button>
          <button id="download" class="icon-button" title="Download resampled preview GeoTIFF" aria-label="Download resampled preview GeoTIFF" disabled><i data-lucide="download"></i></button>
        </div>
      </div>
      <div class="map-surface"><div id="map" aria-label="California lidar map"></div><div id="status-box" class="status-box"><span class="status-dot"></span><span id="status" role="status" aria-live="polite">Opening source</span><button id="cancel" class="icon-button" title="Cancel read" aria-label="Cancel read" hidden><i data-lucide="x"></i></button></div><div id="error" class="error-box" role="alert" hidden></div></div>
      <div class="data-footer">
        <div class="legend"><div class="legend-heading"><strong id="legend-label">Height (m)</strong><span id="sampling">Native 30 m samples</span></div><div id="color-bar"></div><div id="ticks"></div></div>
        <div class="metrics"><div><span>Finite pixels</span><strong id="coverage">--</strong></div><div><span>Preview median</span><strong id="median">--</strong></div><div><span>Preview size</span><strong id="dimensions">--</strong></div></div>
        <div id="inspection" class="inspection"><i data-lucide="crosshair"></i><span id="sample">--</span></div>
      </div>
    </main>
  </div>
  <dialog id="custom-dialog"><form id="custom-form"><h2>Geographic bounds</h2><div class="bounds-grid">${[['west', 'West longitude', -122.30], ['south', 'South latitude', 37.00], ['east', 'East longitude', -121.85], ['north', 'North latitude', 37.35]].map(([id, label, value]) => `<div><label for="${id}">${label}</label><input id="${id}" name="${id}" type="number" step="any" value="${value}" required></div>`).join('')}</div><p id="bounds-error" role="alert"></p><div class="dialog-actions"><button id="custom-cancel" type="button" class="text-button">Cancel</button><button class="text-button primary" type="submit">Load area</button></div></form></dialog>
`;
createIcons({ icons: { Menu, Mountain, Crop, Download, RefreshCw, X, CodeXml, ExternalLink, Crosshair } });

const map = L.map('map', { minZoom: 5, maxZoom: 18, preferCanvas: true, zoomControl: true });
const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
L.control.scale({ imperial: true, metric: true }).addTo(map);
const worker = new Worker(new URL('./raster.worker.js', import.meta.url), { type: 'module' });
let currentPreview = null;
let overlay = null;
let marker = null;
let requestId = 0;
let activeBounds = [...AREAS['Santa Cruz Mountains']];
let lockedLimits = null;
const format = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2 }).format(value);
const formatValue = (value, code) => code === 'campaign_year' ? String(Math.round(value)) : format(value);
const layerFor = (code) => LAYERS.find((layer) => layer.code === code);
const mapBounds = (bounds) => [[bounds[1], bounds[0]], [bounds[3], bounds[2]]];

function sidebar(open) {
  document.body.classList.toggle('sidebar-open', open);
  byId('menu').setAttribute('aria-expanded', String(open));
  setTimeout(() => map.invalidateSize(), 180);
}
function setBusy(busy, message = '') {
  byId('status-box').classList.toggle('loading', busy);
  byId('status').textContent = message;
  byId('cancel').hidden = !busy;
  byId('load').disabled = busy;
  byId('download').disabled = busy || !currentPreview;
}
function clearRaster() {
  overlay?.remove(); overlay = null;
  marker?.remove(); marker = null;
  currentPreview = null;
  for (const id of ['coverage', 'median', 'dimensions', 'sample']) byId(id).textContent = '--';
  byId('color-bar').style.background = 'var(--line)';
  byId('ticks').replaceChildren();
}
function loadBounds(bounds, fit = false) {
  try { validateBounds(bounds); } catch (error) { byId('error').textContent = error.message; byId('error').hidden = false; return; }
  const code = byId('product').value;
  if (fit) map.fitBounds(mapBounds(bounds), { animate: false });
  activeBounds = [...bounds];
  clearRaster();
  byId('error').hidden = true;
  byId('view-title').textContent = layerFor(code).label;
  byId('view-unit').textContent = layerFor(code).units;
  setBusy(true, 'Opening source');
  worker.postMessage({ type: 'load', id: ++requestId, request: { code, bounds,
    edge: Number(byId('edge').value), nativeBudget: matchMedia('(max-width: 700px)').matches ? 3_000_000 : 12_000_000 } });
  sidebar(false);
}
const palettes = { viridis: interpolateViridis, magma: interpolateMagma, cover: interpolateYlGn,
  terrain: interpolateTurbo, cyclic: interpolateRainbow, diverging: (fraction) => interpolateRdBu(1 - fraction), years: interpolateTurbo };
function rgb(color) {
  if (color.startsWith('#')) return [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  return color.match(/[\d.]+/g).slice(0, 3).map(Number);
}
function colorLimits(preview) {
  if (byId('lock-scale').checked && lockedLimits?.code === preview.code) return lockedLimits.limits;
  let limits = byId('stretch').value === 'robust' ? [preview.stats.lower, preview.stats.upper] : [preview.stats.min, preview.stats.max];
  if (preview.code === 'campaign_year') limits = [preview.stats.min, preview.stats.max];
  if (limits[0] === limits[1]) limits = [Math.max(preview.code === 'chm' ? 0 : -Infinity, limits[0] - 0.5), limits[1] + 0.5];
  if (byId('lock-scale').checked) lockedLimits = { code: preview.code, limits };
  return limits;
}
function repaint() {
  if (!currentPreview) return;
  const preview = currentPreview;
  const layer = layerFor(preview.code);
  const [lower, upper] = colorLimits(preview);
  const color = palettes[layer.palette];
  const colors = Array.from({ length: 256 }, (_, index) => rgb(color(index / 255)));
  const canvas = document.createElement('canvas');
  canvas.width = preview.width; canvas.height = preview.height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(preview.width, preview.height);
  for (let index = 0; index < preview.values.length; index += 1) {
    const value = preview.values[index];
    if (!Number.isFinite(value)) continue;
    const category = preview.code === 'campaign_year' ? preview.stats.categories.indexOf(value) / Math.max(1, preview.stats.categories.length - 1) : (value - lower) / (upper - lower);
    const colorIndex = Math.max(0, Math.min(255, Math.round(category * 255)));
    image.data.set([...colors[colorIndex], 255], index * 4);
  }
  context.putImageData(image, 0, 0);
  overlay?.remove();
  overlay = L.imageOverlay(canvas.toDataURL('image/png'), mapBounds(preview.bounds), { opacity: Number(byId('opacity').value) / 100, className: 'raster-overlay' }).addTo(map);
  byId('color-bar').style.background = `linear-gradient(to right, ${Array.from({ length: 12 }, (_, index) => color(index / 11)).join(',')})`;
  const ticks = preview.code === 'campaign_year' ? preview.stats.categories : Array.from({ length: 6 }, (_, index) => lower + (upper - lower) * index / 5);
  byId('ticks').innerHTML = ticks.map((value) => `<span>${preview.code === 'campaign_year' ? Math.round(value) : format(value)}</span>`).join('');
  byId('legend-label').textContent = `${layer.label} (${layer.units})`;
  byId('sampling').textContent = preview.native ? 'Native 30 m samples' : 'Source overview samples';
  byId('coverage').textContent = `${(preview.stats.coverage * 100).toFixed(0)}%`;
  byId('median').textContent = `${formatValue(preview.stats.median, preview.code)} ${layer.units}`;
  byId('dimensions').textContent = `${preview.width} x ${preview.height}`;
}
worker.onmessage = ({ data }) => {
  if (data.id !== requestId) return;
  if (data.type === 'progress') setBusy(true, data.message);
  if (data.type === 'result') { currentPreview = data.preview; repaint(); setBusy(false, 'Preview loaded'); }
  if (data.type === 'cancelled') setBusy(false, 'Read cancelled');
  if (data.type === 'error') { setBusy(false, 'Raster unavailable'); byId('error').textContent = data.message; byId('error').hidden = false; }
};
worker.onerror = (event) => { setBusy(false, 'Reader error'); byId('error').textContent = event.message || 'Browser raster worker failed.'; byId('error').hidden = false; };
byId('menu').onclick = () => sidebar(!document.body.classList.contains('sidebar-open'));
byId('close-sidebar').onclick = () => sidebar(false);
byId('product').onchange = () => { lockedLimits = null; loadBounds(activeBounds); };
byId('edge').onchange = () => loadBounds(activeBounds);
byId('area').onchange = () => {
  byId('custom-open').hidden = byId('area').value !== 'Custom bounds';
  if (byId('area').value === 'Custom bounds') byId('custom-dialog').showModal();
  else loadBounds(AREAS[byId('area').value], true);
};
byId('custom-open').onclick = () => byId('custom-dialog').showModal();
byId('custom-cancel').onclick = () => byId('custom-dialog').close();
byId('custom-form').onsubmit = (event) => {
  event.preventDefault();
  const bounds = ['west', 'south', 'east', 'north'].map((id) => Number(byId(id).value));
  try { validateBounds(bounds); } catch (error) { byId('bounds-error').textContent = error.message; return; }
  byId('bounds-error').textContent = ''; byId('custom-dialog').close(); loadBounds(bounds, true);
};
byId('load').onclick = () => {
  const bounds = map.getBounds();
  loadBounds([Math.max(-126, bounds.getWest()), Math.max(31, bounds.getSouth()), Math.min(-113, bounds.getEast()), Math.min(43, bounds.getNorth())]);
  byId('area').value = 'Custom bounds'; byId('custom-open').hidden = false;
};
byId('reset').onclick = () => loadBounds(AREAS[byId('area').value] || activeBounds, true);
byId('cancel').onclick = () => { worker.postMessage({ type: 'cancel' }); setBusy(false, 'Cancelling read'); };
byId('opacity').oninput = () => { byId('opacity-value').textContent = `${byId('opacity').value}%`; overlay?.setOpacity(Number(byId('opacity').value) / 100); };
byId('stretch').onchange = () => { if (!byId('lock-scale').checked) lockedLimits = null; repaint(); };
byId('lock-scale').onchange = () => { lockedLimits = null; repaint(); };
byId('basemap').onchange = () => { if (byId('basemap').value === 'none') baseLayer.remove(); else baseLayer.addTo(map); };
byId('download').onclick = async () => {
  if (!currentPreview) return;
  byId('download').disabled = true;
  try {
    const url = URL.createObjectURL(new Blob([await exportPreview(currentPreview)], { type: 'image/tiff' }));
    const link = document.createElement('a'); link.href = url; link.download = `werk_30m_${currentPreview.code}_resampled_preview.tif`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) { byId('error').textContent = error.message; byId('error').hidden = false; }
  finally { byId('download').disabled = !currentPreview; }
};
map.on('click', ({ latlng }) => {
  if (!currentPreview) return;
  const [nativeX, nativeY] = proj4('EPSG:4326', 'EPSG:3857', [latlng.lng, latlng.lat]);
  const [left, bottom, right, top] = currentPreview.mercatorBounds;
  const column = Math.floor((nativeX - left) / (right - left) * currentPreview.width);
  const row = Math.floor((top - nativeY) / (top - bottom) * currentPreview.height);
  const value = column >= 0 && row >= 0 && column < currentPreview.width && row < currentPreview.height ? currentPreview.values[row * currentPreview.width + column] : NaN;
  marker?.remove(); marker = L.circleMarker(latlng, { radius: 5, color: '#ffffff', weight: 2, fillColor: '#202e29', fillOpacity: 1 }).addTo(map);
  byId('sample').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} / ${Number.isFinite(value) ? `${formatValue(value, currentPreview.code)} ${layerFor(currentPreview.code).units}` : 'No data'} / preview sample`;
});
new ResizeObserver(() => map.invalidateSize()).observe(byId('map'));
loadBounds(activeBounds, true);
