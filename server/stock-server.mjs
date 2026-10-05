// design-first stock helper — a tiny MCP server (stdio, zero dependencies, Node 18+).
// It exists for one reason: the Pixabay key is a secret, and a skill cannot read secrets.
// The key arrives in the environment (PIXABAY_API_KEY, filled from the plugin's userConfig) and is
// used for exactly one host, pixabay.com. The only data sent out is the search words.
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';

const API = 'https://pixabay.com/api/';
const UA = { 'User-Agent': 'design-first-plugin/1.0' };
const rawKey = (process.env.PIXABAY_API_KEY || '').trim();
const KEY = rawKey && !rawKey.includes('${') ? rawKey : '';

const NO_KEY = `No Pixabay key is set, so photo search is off.

Tell the user this, in their language, as a short numbered list:
1. Open https://pixabay.com/api/docs/ in a browser.
2. Press "Sign up" (top right) and register — a Google account works. It is free.
3. Come back to the same page. In the "Parameters" table, the row "key" now shows the key in green instead of "Please login".
4. Copy the key. In Claude Code run /plugin, open design-first, choose "Configure", and paste it into "Pixabay API key".
5. Start a new session (or run /reload-plugins) and ask for the design again.

Until then, go on without stock photos: type-led and CSS-drawn screens only, plus any photos the user gives you. Say once that photo screens are waiting for the key.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, tries = 5) {
  let last;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429) { last = new Error('429 Too Many Requests'); await sleep(2500 + 3500 * t); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
      return r;
    } catch (e) { last = e; if (!/429/.test(String(e.message))) await sleep(1200); }
  }
  throw last;
}

const needAbs = (p, name) => { if (typeof p !== 'string' || !isAbsolute(p)) throw new Error(`${name} must be an absolute path`); return p; };

async function search({ queries, out_dir, vertical = false, per_query = 6 }) {
  if (!Array.isArray(queries) || !queries.length) throw new Error('queries: a non-empty list of search strings');
  needAbs(out_dir, 'out_dir');
  const n = Math.max(1, Math.min(12, per_query | 0));
  const prev = join(out_dir, 'previews'); mkdirSync(prev, { recursive: true });
  const cands = []; const seen = new Set(); const lines = [];
  for (const q of queries.slice(0, 10)) {
    const p = new URLSearchParams({ key: KEY, q, image_type: 'photo', safesearch: 'true', per_page: String(Math.max(n * 2, 20)),
      orientation: vertical ? 'vertical' : 'horizontal' });
    p.set(vertical ? 'min_height' : 'min_width', '2400');
    const d = await (await fetchRetry(`${API}?${p}`)).json();
    const hits = (d.hits || []).filter((h) => !h.isAiGenerated && !h.isLowQuality).slice(0, n);
    let added = 0;
    for (const h of hits) {
      if (seen.has(h.id)) continue; seen.add(h.id); added++;
      cands.push({ index: cands.length, query: q, id: h.id, width: h.imageWidth, height: h.imageHeight, author: h.user,
        page: h.pageURL, tags: h.tags, preview_url: h.webformatURL, large_url: h.largeImageURL });
    }
    lines.push(`"${q}": ${added} new`);
  }
  let missing = 0;
  for (const c of cands) {
    try {
      const buf = Buffer.from(await (await fetchRetry(c.preview_url)).arrayBuffer());
      c.preview = `previews/${c.index}.jpg`; writeFileSync(join(out_dir, c.preview), buf);
    } catch { missing++; }
    await sleep(450);
  }
  writeFileSync(join(out_dir, 'candidates.json'), JSON.stringify(cands, null, 1));
  return `${cands.length} candidates saved to ${join(out_dir, 'candidates.json')} (${lines.join('; ')})` +
    (missing ? `; ${missing} previews could not be downloaded` : '') +
    `.\nNext: node <skill-dir>/scripts/photo.mjs sheet "${join(out_dir, 'candidates.json')}" — then LOOK at sheet.jpg before choosing.`;
}

async function download({ candidates, assets_dir, picks }) {
  needAbs(candidates, 'candidates'); needAbs(assets_dir, 'assets_dir');
  if (!Array.isArray(picks) || !picks.length) throw new Error('picks: a list of {index, name}');
  const cands = JSON.parse(readFileSync(candidates, 'utf8')); mkdirSync(assets_dir, { recursive: true });
  const cp = join(assets_dir, 'credits.json');
  let credits = existsSync(cp) ? JSON.parse(readFileSync(cp, 'utf8')) : [];
  const out = [];
  for (const pick of picks.slice(0, 12)) {
    const c = cands[pick.index];
    if (!c) { out.push(`index ${pick.index}: not in candidates.json`); continue; }
    const name = String(pick.name || `p${c.id}`).replace(/[^\w-]+/g, '_') + '.jpg';
    try {
      const buf = Buffer.from(await (await fetchRetry(c.large_url)).arrayBuffer());
      writeFileSync(join(assets_dir, name), buf);
      credits = credits.filter((x) => x.file !== name).concat({ file: name, author: c.author, page: c.page, source: 'Pixabay', license: 'Pixabay Content License' });
      const kb = Math.round(statSync(join(assets_dir, name)).size / 1024);
      out.push(`${name}: ok, ${kb} KB, by ${c.author}` + (kb < 120 ? ' — heavily compressed: use only for fog, night or texture' : ''));
    } catch (e) { out.push(`${name}: FAILED (${e.message}) — the link may have expired, run the search again`); }
    await sleep(600);
  }
  writeFileSync(cp, JSON.stringify(credits, null, 1));
  return out.join('\n') + `\nCredits: ${cp}. Files are 1280 px wide.`;
}

const TOOLS = [
  { name: 'stock_search',
    description: 'Search free stock photos on Pixabay for the design-first skill. Saves candidates.json and small previews into out_dir; nothing is shown yet — build the contact sheet with photo.mjs and look at it. AI-generated and low-quality photos are filtered out.',
    inputSchema: { type: 'object', required: ['queries', 'out_dir'], properties: {
      queries: { type: 'array', items: { type: 'string' }, description: 'Up to 10 queries, English, two or three concrete nouns each' },
      out_dir: { type: 'string', description: 'Absolute path of a folder for candidates.json and previews/' },
      vertical: { type: 'boolean', description: 'Portrait photos (for phone crops). Default false' },
      per_query: { type: 'integer', description: 'Photos kept per query, 1–12. Default 6' } } } },
  { name: 'stock_download',
    description: 'Download chosen stock photos (1280 px wide) into the page assets folder and record author credits in credits.json.',
    inputSchema: { type: 'object', required: ['candidates', 'assets_dir', 'picks'], properties: {
      candidates: { type: 'string', description: 'Absolute path of candidates.json from stock_search' },
      assets_dir: { type: 'string', description: 'Absolute path of the page assets folder' },
      picks: { type: 'array', items: { type: 'object', required: ['index'], properties: {
        index: { type: 'integer' }, name: { type: 'string', description: 'File name without extension' } } } } } } },
];

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });

async function handle(m) {
  if (m.method === 'initialize') return { protocolVersion: m.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} },
    serverInfo: { name: 'design-first-stock', version: '1.0.0' } };
  if (m.method === 'ping') return {};
  if (m.method === 'tools/list') return { tools: TOOLS };
  if (m.method === 'tools/call') {
    const { name, arguments: a = {} } = m.params || {};
    if (name !== 'stock_search' && name !== 'stock_download') return text(`Unknown tool: ${name}`, true);
    if (!KEY) return text(NO_KEY, true);
    try { return text(name === 'stock_search' ? await search(a) : await download(a)); }
    catch (e) {
      const msg = String(e.message || e);
      return text(/HTTP 400|Invalid or missing API key/i.test(msg) ? `Pixabay rejected the key (${msg}).\n\n${NO_KEY}` : `Failed: ${msg}`, true);
    }
  }
  throw Object.assign(new Error('Method not found'), { code: -32601 });
}

let chain = Promise.resolve();
createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;                       // notifications need no answer
  chain = chain.then(async () => {
    try { send({ jsonrpc: '2.0', id: m.id, result: await handle(m) }); }
    catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: e.code || -32603, message: String(e.message || e) } }); }
  });
});
