// Fetches the /news feeds server-side and writes news-data.json so the
// page can paint instantly from same-origin data before live feeds load.
import { writeFileSync } from 'node:fs';

const MAX_ITEMS = 30;
const UA = 'Mozilla/5.0 (compatible; ricburton.com news sync)';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, redirect: 'follow' });
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
    if (title && link) items.push({ title, link, time: isNaN(time) ? null : time });
  }
  return items;
}

function sortRecent(items) {
  return items.sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, MAX_ITEMS);
}

async function rss(url) {
  return sortRecent(parseRss(await get(url)));
}

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

const out = { generatedAt: Date.now(), sources: {} };
let failures = 0;
for (const [id, fn] of Object.entries(FEEDS)) {
  try {
    const items = await fn();
    out.sources[id] = { items };
    console.log(`${id}: ${items.length} items`);
  } catch (e) {
    failures++;
    console.error(`${id}: FAILED — ${e.message}`);
  }
}

if (Object.keys(out.sources).length === 0) {
  console.error('All feeds failed; not writing news-data.json');
  process.exit(1);
}
writeFileSync(new URL('../news-data.json', import.meta.url), JSON.stringify(out));
console.log(`Wrote news-data.json (${failures} feed(s) failed)`);
