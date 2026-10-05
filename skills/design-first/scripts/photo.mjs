#!/usr/bin/env node
// photo.mjs — look at stock candidates and measure a photo before the layout is built around it.
// Zero dependencies: Node 22+ (global WebSocket) + an installed Chrome/Edge/Chromium.
//
//   node photo.mjs sheet <candidates.json>            -> sheet.jpg next to it (number = index)
//   node photo.mjs analyze <photo> [--crop x0,y0,x1,y1] [--out overlay.png] [--json]   -> a 5-line summary (or JSON)
//
// analyze: best_zone (calmest area for text, or null), text_on_photo, per-zone busy / text colour /
// worst_contrast, focus (x, y of the visual weight), palette. --crop measures only the window that
// will be visible after object-fit: cover, in fractions of the frame.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const outOpt = opt('--out', null);
const cropOpt = opt('--crop', null);
const jsonOpt = argv.includes('--json') ? (argv.splice(argv.indexOf('--json'), 1), true) : false;
const [cmd, target] = argv;
if (!['sheet', 'analyze'].includes(cmd) || !target) {
  console.error('usage: node photo.mjs sheet <candidates.json> | analyze <photo> [--crop x0,y0,x1,y1] [--out overlay.png] [--json]'); process.exit(2);
}

const chromePath = () => {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const hit = c.find((p) => existsSync(p));
  if (!hit) throw new Error('No Chrome/Edge found — set CHROME_PATH');
  return hit;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataUrl = (file) => 'data:image/jpeg;base64,' + readFileSync(file).toString('base64');

// ---------- the in-page measurement ----------
const ANALYZE = String.raw`(async (src, crop) => {
  const ZONES = { left: [0.04, 0.12, 0.48, 0.88], right: [0.52, 0.12, 0.96, 0.88], top: [0.08, 0.06, 0.92, 0.42],
    bottom: [0.08, 0.58, 0.92, 0.94], center: [0.22, 0.22, 0.78, 0.78] };
  const BUSY_MAX = 0.20, CONTRAST_MIN = 3.0;
  const img = new Image(); img.src = src; await img.decode();
  const sx = crop ? crop[0] * img.naturalWidth : 0, sy = crop ? crop[1] * img.naturalHeight : 0;
  const sw = crop ? (crop[2] - crop[0]) * img.naturalWidth : img.naturalWidth, sh = crop ? (crop[3] - crop[1]) * img.naturalHeight : img.naturalHeight;
  const k = Math.min(1, 640 / Math.max(sw, sh)); const w = Math.round(sw * k), h = Math.round(sh * k);
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }); const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data;
  const bl = Object.assign(document.createElement('canvas'), { width: w, height: h }); const bx = bl.getContext('2d', { willReadFrequently: true });
  bx.filter = 'blur(1px)'; bx.drawImage(cv, 0, 0); const bp = bx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h), L = new Float32Array(w * h);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * bp[i * 4] + 0.587 * bp[i * 4 + 1] + 0.114 * bp[i * 4 + 2];
    L[i] = 0.2126 * lin(px[i * 4]) + 0.7152 * lin(px[i * 4 + 1]) + 0.0722 * lin(px[i * 4 + 2]);
  }
  const e = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = Math.max(0, x - 1), xr = Math.min(w - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(h - 1, y + 1);
    const gx = (g[y * w + xr] - g[y * w + xl]) / (xr - xl), gy = (g[yd * w + x] - g[yu * w + x]) / (yd - yu);
    e[y * w + x] = Math.hypot(gx, gy);
  }
  const pct = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p / 100 * (s.length - 1)))]; };
  const p99 = pct(e, 99) + 1e-6; for (let i = 0; i < e.length; i++) e[i] /= p99;
  const con = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const zones = {};
  for (const [name, [x0, y0, x1, y1]] of Object.entries(ZONES)) {
    const ls = []; let busy = 0, n = 0;
    for (let y = Math.floor(y0 * h); y < Math.floor(y1 * h); y++) for (let x = Math.floor(x0 * w); x < Math.floor(x1 * w); x++) { busy += e[y * w + x]; ls.push(L[y * w + x]); n++; }
    const l10 = pct(ls, 10), l50 = pct(ls, 50), l90 = pct(ls, 90); const white = con(1, l90), black = con(l10, 0);
    zones[name] = { busy: +(busy / n).toFixed(3), lum: +l50.toFixed(3), text: white >= black ? 'white' : 'black', worst_contrast: +Math.max(white, black).toFixed(2) };
  }
  let sxw = 0, syw = 0, sum = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = e[y * w + x] * e[y * w + x]; sxw += x * v; syw += y * v; sum += v; }
  const focus = [+(sxw / sum / w).toFixed(2), +(syw / sum / h).toFixed(2)];
  // a zone is usable when it is calm, readable, and does not sit on the subject (the focus point)
  for (const [name, z] of Object.entries(zones)) {
    const r = ZONES[name];
    z.holds_subject = focus[0] > r[0] && focus[0] < r[2] && focus[1] > r[1] && focus[1] < r[3];
    z.usable = z.busy <= BUSY_MAX && z.worst_contrast >= CONTRAST_MIN && !z.holds_subject;
  }
  // text straight on the photo (contrast 4.5+) beats a calmer zone that needs a panel
  const score = (z) => (z.usable ? 0 : 10) + (z.worst_contrast >= 4.5 ? 0 : 1) + z.busy - 0.02 * Math.min(z.worst_contrast, 7);
  const best = Object.keys(zones).sort((a, b) => score(zones[a]) - score(zones[b]))[0];
  const usable = zones[best].usable;
  const bins = new Map();
  for (let i = 0; i < w * h; i += 2) { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]; const key = (r >> 6) << 4 | (gg >> 6) << 2 | (b >> 6);
    const o = bins.get(key) || [0, 0, 0, 0]; o[0] += r; o[1] += gg; o[2] += b; o[3]++; bins.set(key, o); }
  const palette = [...bins.values()].sort((a, b) => b[3] - a[3]).slice(0, 6)
    .map((o) => '#' + [0, 1, 2].map((j) => Math.round(o[j] / o[3]).toString(16).padStart(2, '0')).join(''));
  // overlay: the frame, the chosen zone, the focus, the palette
  cx.lineWidth = 4; cx.strokeStyle = usable ? '#ff2d2d' : '#9a9a9a'; const z = ZONES[best];
  cx.strokeRect(z[0] * w, z[1] * h, (z[2] - z[0]) * w, (z[3] - z[1]) * h);
  cx.strokeStyle = '#ffe600'; cx.beginPath(); cx.arc(focus[0] * w, focus[1] * h, 9, 0, 7); cx.stroke();
  palette.forEach((c, i) => { cx.fillStyle = c; cx.fillRect(i * 40, h - 30, 40, 30); });
  return { size: [img.naturalWidth, img.naturalHeight], crop, best_zone: usable ? best : null,
    text_on_photo: usable && zones[best].worst_contrast >= 4.5 ? 'yes' : usable ? 'with a local gradient or panel' : 'no: put the text on a flat field',
    least_busy_zone: best, zones, focus, palette, overlay: cv.toDataURL('image/png') };
})`;

const sheetHtml = (cands, dir) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font:12px/1.2 system-ui,sans-serif;color:#111}
.g{display:grid;grid-template-columns:repeat(6,300px);width:1800px}
.c{height:238px;padding:3px;box-sizing:border-box;overflow:hidden}
.c img{display:block;width:294px;height:206px;object-fit:contain;object-position:left top;background:#f2f2f2}
.c b{font-size:15px}</style><div class="g">${cands.map((c) => `<div class="c">${c.preview && existsSync(join(dir, c.preview))
    ? `<img src="${dataUrl(join(dir, c.preview))}">` : '<img alt="">'}<div><b>${c.index}</b> · ${String(c.query).replace(/[<&]/g, '').slice(0, 28)} · ${String(c.author).replace(/[<&]/g, '').slice(0, 14)}</div></div>`).join('')}</div>`;

async function withChrome(fn) {
  const profile = mkdtempSync(join(tmpdir(), 'df-photo-'));
  const chrome = spawn(chromePath(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let t = 0; t < 100 && !port; t++) { await sleep(100); const f = join(profile, 'DevToolsActivePort'); if (existsSync(f)) port = readFileSync(f, 'utf8').split('\n')[0].trim(); }
  if (!port) { chrome.kill(); throw new Error('Chrome did not start'); }
  let ws;
  try {
    const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    await send('Page.enable'); await send('Runtime.enable');
    return await fn({ send, evaluate });
  } finally {
    try { ws.close(); } catch {}
    chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  const file = resolve(target);
  if (!existsSync(file)) throw new Error('No such file: ' + file);
  if (cmd === 'sheet') {
    const dir = dirname(file); const cands = JSON.parse(readFileSync(file, 'utf8'));
    if (!cands.length) throw new Error('candidates.json is empty — run the search with other queries');
    const html = join(dir, 'sheet.html'); writeFileSync(html, sheetHtml(cands, dir));
    const out = resolve(outOpt || join(dir, 'sheet.jpg')); const height = Math.ceil(cands.length / 6) * 238;
    await withChrome(async ({ send, evaluate }) => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1800, height, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: 'file:///' + html.replace(/\\/g, '/') }); await sleep(600);
      await evaluate('Promise.all([...document.images].map((i) => i.decode().catch(() => 0)))');
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      writeFileSync(out, Buffer.from(shot.data, 'base64'));
    });
    try { rmSync(html); } catch {}
    console.log(`${cands.length} candidates → ${out}\nLook at it. The bold number under each photo is its index for stock_download.`);
    return;
  }
  const crop = cropOpt ? cropOpt.split(',').map(Number) : null;
  if (crop && (crop.length !== 4 || crop.some((v) => !(v >= 0 && v <= 1)) || crop[2] <= crop[0] || crop[3] <= crop[1])) throw new Error('--crop wants x0,y0,x1,y1 as fractions, e.g. 0.3,0,1,1');
  const res = await withChrome(({ evaluate }) => evaluate(`${ANALYZE}(${JSON.stringify(dataUrl(file))}, ${JSON.stringify(crop)})`));
  if (outOpt) { mkdirSync(dirname(resolve(outOpt)), { recursive: true }); writeFileSync(resolve(outOpt), Buffer.from(res.overlay.split(',')[1], 'base64')); }
  delete res.overlay;
  if (jsonOpt) { console.log(JSON.stringify({ file, ...res }, null, 1)); return; }
  const z = res.zones[res.least_busy_zone];
  console.log(`${basename(file)} ${res.size.join('x')}${crop ? ' crop ' + crop.join(',') : ''}\n` +
    `  text zone: ${res.best_zone || 'none'} — text on photo: ${res.text_on_photo}` +
    (res.best_zone ? ` (${z.text} text, contrast ${z.worst_contrast}, busy ${z.busy})` : ` (least busy: ${res.least_busy_zone}, busy ${z.busy}, contrast ${z.worst_contrast}${z.holds_subject ? ', the subject sits there' : ''})`) + '\n' +
    `  focus: ${Math.round(res.focus[0] * 100)}% ${Math.round(res.focus[1] * 100)}%   (object-position)\n` +
    `  palette: ${res.palette.join(' ')}\n` +
    `  all zones: ${Object.entries(res.zones).map(([n, v]) => `${n} ${v.usable ? 'ok' : 'no'}`).join(', ')}   (--json for the numbers)`);
}

main().catch((e) => { console.error('photo.mjs: ' + (e.message || e)); process.exit(1); });
