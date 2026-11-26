// News poller + API for ricburton.com/news.
// Runs on the DigitalOcean box as the `news-server` systemd unit, behind
// Caddy at https://explore-reality.ricburton.com/news-api/.
// Polls every feed once a minute, keeps the last good result per source
// in memory (and on disk across restarts), and serves it as JSON.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseTechmeme, countPosts } from './techmeme.mjs';

const PORT = +(process.env.PORT || 8787);
const POLL_MS = +(process.env.POLL_MS || 60_000);
const STATE_DIR = process.env.STATE_DIRECTORY || '/tmp';
const STATE_FILE = join(STATE_DIR, 'news.json');
const MAX_ITEMS = 30;
const TECHMEME_POLL_MS = +(process.env.TECHMEME_POLL_MS || 5 * 60_000);
const TECHMEME_FILE = join(STATE_DIR, 'techmeme.json');
const UA = 'Mozilla/5.0 (compatible; ricburton.com news poller)';
const ALLOWED_ORIGINS = new Set(['https://ricburton.com', 'https://www.ricburton.com']);

async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`http ${res.status} for ${url}`);
  return res.text();
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = m[0];
    const tag = name => {
      const t = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
      return t ? decodeEntities(t[1]) : '';
    };
    const title = tag('title');
    const link = tag('link');
    const date = tag('pubDate') || tag('dc:date') || tag('date');
    const time = date ? Date.parse(date) : NaN;
    if (title && /^https?:\/\//.test(link)) items.push({ title, link, time: isNaN(time) ? null : time });
  }
  return items;
}

const sortRecent = items => items.sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, MAX_ITEMS);
const rss = async url => sortRecent(parseRss(await get(url)));

async function rssMerged(urls) {
  const results = await Promise.allSettled(urls.map(rss));
  const ok = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  if (!ok.length) throw results[0].reason;
  const seen = new Set();
  return sortRecent(ok.filter(it => !seen.has(it.link) && seen.add(it.link)));
}

async function hackerNews() {
  const data = JSON.parse(await get('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=' + MAX_ITEMS));
  return data.hits.map(h => ({
    title: h.title,
    link: h.url || ('https://news.ycombinator.com/item?id=' + h.objectID),
    time: Date.parse(h.created_at) || null,
    meta: h.points + ' points · ',
    metaLink: { href: 'https://news.ycombinator.com/item?id=' + h.objectID, text: (h.num_comments || 0) + ' comments' },
  }));
}

const FEEDS = {
  hn: hackerNews,
  techmeme: () => rss('https://www.techmeme.com/feed.xml'),
  economist: () => rss('https://www.economist.com/latest/rss.xml'),
  wsj: () => rssMerged([
    'https://feeds.content.dowjones.io/public/rss/RSSWorldNews',
    'https://feeds.content.dowjones.io/public/rss/RSSWSJD',
  ]),
  bbc: () => rss('https://feeds.bbci.co.uk/news/rss.xml'),
};

// state.sources[id] = { items, fetchedAt, error? } — items are the last good result
let state = { generatedAt: 0, sources: {} };
try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}
let body = '', etag = '';

function publish() {
  body = JSON.stringify(state);
  etag = '"' + createHash('sha1').update(JSON.stringify(Object.fromEntries(
    Object.entries(state.sources).map(([id, s]) => [id, s.items])))).digest('hex').slice(0, 16) + '"';
}
publish();

async function poll() {
  const now = Date.now();
  await Promise.all(Object.entries(FEEDS).map(async ([id, fn]) => {
    try {
      const items = await fn();
      if (!items.length) throw new Error('empty feed');
      state.sources[id] = { items, fetchedAt: now };
    } catch (e) {
      console.error(`${id}: ${e.message}`);
      state.sources[id] = { items: [], fetchedAt: 0, ...state.sources[id], error: String(e.message).slice(0, 200) };
    }
  }));
  state.generatedAt = now;
  publish();
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE + '.tmp', body);
    renameSync(STATE_FILE + '.tmp', STATE_FILE);
  } catch (e) { console.error('state write failed: ' + e.message); }
}

async function loop() {
  try { await poll(); } catch (e) { console.error('poll failed: ' + e.message); }
  setTimeout(loop, POLL_MS);
}
loop();

// Techmeme's front page with every indexed post expanded, for
// ricburton.com/techmeme. One page fetch every five minutes; the last good
// parse is kept (and saved) so a failed fetch never empties the page.
let techmeme = { generatedAt: 0, stories: [], posts: 0 };
try { techmeme = JSON.parse(readFileSync(TECHMEME_FILE, 'utf8')); } catch {}
let techmemeBody = JSON.stringify(techmeme), techmemeEtag = '"tm-' + techmeme.generatedAt + '"';

async function pollTechmeme() {
  const stories = parseTechmeme(await get('https://www.techmeme.com/'));
  if (stories.length < 5) throw new Error(`only ${stories.length} stories parsed`);
  // The front page carries no timestamps; the feed does, for the newest stories.
  const times = new Map((state.sources.techmeme?.items || []).map(it => [it.link.split('#a')[1], it.time]));
  const known = new Map(techmeme.stories.flatMap(s => [s, ...s.related]).map(s => [s.id, s.time]));
  const stamp = s => { s.time = times.get(s.id) ?? known.get(s.id) ?? null; };
  for (const s of stories) { stamp(s); s.related.forEach(stamp); }
  techmeme = { generatedAt: Date.now(), stories, posts: countPosts(stories) };
  techmemeBody = JSON.stringify(techmeme);
  techmemeEtag = '"tm-' + createHash('sha1').update(JSON.stringify(stories)).digest('hex').slice(0, 16) + '"';
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(TECHMEME_FILE + '.tmp', techmemeBody);
    renameSync(TECHMEME_FILE + '.tmp', TECHMEME_FILE);
  } catch (e) { console.error('techmeme state write failed: ' + e.message); }
}

async function techmemeLoop() {
  try { await pollTechmeme(); } catch (e) { console.error('techmeme: ' + e.message); }
  setTimeout(techmemeLoop, TECHMEME_POLL_MS);
}
setTimeout(techmemeLoop, 5_000);

createServer((req, res) => {
  const origin = req.headers.origin;
  const headers = { 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  const path = (req.url || '').split('?')[0].replace(/^\/news-api/, '');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, headers).end();
  } else if (path === '/news.json') {
    headers['ETag'] = etag;
    headers['Cache-Control'] = 'no-cache';
    if (req.headers['if-none-match'] === etag) return res.writeHead(304, headers).end();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
  } else if (path === '/techmeme.json') {
    headers['ETag'] = techmemeEtag;
    headers['Cache-Control'] = 'no-cache';
    if (req.headers['if-none-match'] === techmemeEtag) return res.writeHead(304, headers).end();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : techmemeBody);
  } else if (path === '/health') {
    const age = Math.round((Date.now() - state.generatedAt) / 1000);
    const sources = Object.fromEntries(Object.entries(state.sources).map(([id, s]) =>
      [id, { items: s.items.length, ageSeconds: Math.round((Date.now() - s.fetchedAt) / 1000), error: s.error || null }]));
    headers['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(age < 300 ? 200 : 503, headers).end(JSON.stringify({ ok: age < 300, pollAgeSeconds: age, sources,
      techmeme: { stories: techmeme.stories.length, posts: techmeme.posts, ageSeconds: Math.round((Date.now() - techmeme.generatedAt) / 1000) } }));
  } else {
    res.writeHead(404, headers).end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`news-server on 127.0.0.1:${PORT}, polling every ${POLL_MS / 1000}s`));
