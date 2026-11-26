// Parses Techmeme's front page into stories with every indexed post spelled
// out. The page ships each story twice: a compact form that lists outlets by
// name only, and a full form (hidden until you click) that carries every
// outlet's own headline plus the X, Bluesky and forum posts. This reads the
// full form, falling back to the compact one where a story has no full form.

function decode(s) {
  return s
    .replace(/&#(\d+);?/g, (_, n) => safeCodePoint(+n))
    .replace(/&#x([0-9a-f]+);?/gi, (_, n) => safeCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function safeCodePoint(n) {
  try { return String.fromCodePoint(n); } catch { return ''; }
}

const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function httpUrl(raw) {
  const url = decode(raw || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => ({ url: httpUrl(m[1]), text: text(m[2]) }))
    .filter(a => a.url);
}

// "Author / <a>Outlet</a>:" or "<a>Outlet</a>:" or "Name / <a>@handle</a>:"
function byline(citeHtml) {
  const link = anchors(citeHtml)[0];
  const whole = text(citeHtml).replace(/:\s*$/, '');
  const parts = whole.split(' / ');
  const source = link ? link.text : parts[parts.length - 1];
  const author = parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
  return { author, source, sourceUrl: link ? link.url : '' };
}

// The html of the element that starts at `start` (the index of its "<div").
function divAt(html, start) {
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0, m;
  while ((m = tag.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.lastIndex);
  }
  return html.slice(start);
}

function sections(full) {
  const out = [];
  const heads = [...full.matchAll(/<div class="drhed">([\s\S]*?)<\/div>/gi)];
  heads.forEach((head, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : full.length;
    const chunk = full.slice(head.index + head[0].length, end);
    const posts = [];
    for (const m of chunk.matchAll(/<div class="di">([\s\S]*?)<\/div>/gi)) {
      const cite = m[1].match(/<cite>([\s\S]*?)<\/cite>/i);
      const rest = cite ? m[1].slice(cite.index + cite[0].length) : m[1];
      const link = anchors(rest)[0];
      if (!link || !link.text) continue;
      posts.push({ ...(cite ? byline(cite[1]) : { author: '', source: '', sourceUrl: '' }), title: link.text, url: link.url });
    }
    if (posts.length) out.push({ label: text(head[1]).replace(/:\s*$/, ''), posts });
  });
  return out;
}

// Outlets named without a headline, from the compact form.
function compactSections(compact) {
  const out = [];
  for (const m of compact.matchAll(/<span class="drhed">([\s\S]*?)<\/span>(?:&nbsp;|\s)*<span class="bls">([\s\S]*?)<\/span>/gi)) {
    const posts = anchors(m[2]).map(a => ({ author: '', source: a.text, sourceUrl: '', title: '', url: a.url }));
    if (posts.length) out.push({ label: text(m[1]).replace(/:\s*$/, ''), posts });
  }
  return out;
}

function parseItem(html, cluster, n) {
  const cite = html.match(/<cite>([\s\S]*?)<\/cite>/i);
  const iiStart = html.search(/<div class="ii">/i);
  if (iiStart < 0) return null;
  const ii = divAt(html, iiStart);
  const head = ii.match(/<strong[^>]*>\s*<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/strong>([\s\S]*)$/i);
  if (!head) return null;
  const url = httpUrl(head[1]);
  const title = text(head[2]);
  if (!url || !title) return null;
  const summary = text(head[3]).replace(/^[—–\s]+/, '');
  const pml = html.match(/\bpml="([^"]+)"/i);
  // Techmeme's own small crop of the article's picture, used when the
  // article itself won't give one up.
  const ill = ii.match(/<img\b[^>]*class="ill"[^>]*src="([^"]+)"/i);
  const thumb = ill ? httpUrl(new URL(decode(ill[1]), 'https://www.techmeme.com/').toString()) : '';

  const fullStart = html.search(new RegExp(`<div id="${cluster}p${n}"`, 'i'));
  const compactStart = html.search(new RegExp(`<div id="${cluster}d${n}"`, 'i'));
  let posts = fullStart >= 0 ? sections(divAt(html, fullStart)) : [];
  if (!posts.length && compactStart >= 0) posts = compactSections(divAt(html, compactStart));

  return {
    id: pml ? pml[1] : `${cluster}-${n}`,
    permalink: pml ? `https://www.techmeme.com/${pml[1].replace(/p/, '/p')}#a${pml[1]}` : '',
    ...(cite ? byline(cite[1]) : { author: '', source: '', sourceUrl: '' }),
    title, url, summary, thumb,
    sections: posts,
  };
}

export function parseTechmeme(html) {
  const stories = [];
  const starts = [...html.matchAll(/<div class="clus">/gi)].map(m => m.index);
  starts.forEach((start, i) => {
    const clus = html.slice(start, i + 1 < starts.length ? starts[i + 1] : html.length);
    const marks = [...clus.matchAll(/<div class="item" id="(\d+)i(\d+)">/gi)];
    // Items share a story when they share its number ("3i1", "3i2"). The
    // shorter stories further down the page sit in one block with a number
    // each, so the number, not the block, decides what belongs together.
    const byStory = new Map();
    marks.forEach((m, k) => {
      const item = parseItem(
        clus.slice(m.index, k + 1 < marks.length ? marks[k + 1].index : clus.length), m[1], m[2]
      );
      if (!item) return;
      if (!byStory.has(m[1])) byStory.set(m[1], []);
      byStory.get(m[1]).push(item);
    });
    for (const items of byStory.values()) stories.push({ ...items[0], related: items.slice(1) });
  });
  return stories;
}

// The picture an article nominates for link previews.
export function previewImage(html, pageUrl) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  for (const name of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    for (const meta of metas) {
      if (!new RegExp(`(?:property|name)=["']${name}["']`, 'i').test(meta)) continue;
      const content = meta.match(/content=["']([^"']+)["']/i);
      if (!content) continue;
      try {
        const url = new URL(decode(content[1]).trim(), pageUrl);
        if (url.protocol === 'https:') return url.toString();
      } catch {}
    }
  }
  return '';
}

export function countPosts(stories) {
  const count = item => item.sections.reduce((n, s) => n + s.posts.length, 0);
  return stories.reduce((n, s) => n + 1 + count(s) + s.related.reduce((k, r) => k + 1 + count(r), 0), 0);
}
