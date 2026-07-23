// Fetches likes, reposts and playlists for the profile below from
// SoundCloud's public web API and writes music-data.json for /music.html.
// Runs in GitHub Actions (see .github/workflows/soundcloud-sync.yml).
//
// SOUNDCLOUD_CLIENT_ID env (Actions secret) is used when set; otherwise the
// script discovers the public web client_id from soundcloud.com's JS bundles.
// No client secret is required — this only reads public data.

const PROFILE = 'https://soundcloud.com/ricburton';
const API = 'https://api-v2.soundcloud.com';
const OUT = new URL('../music-data.json', import.meta.url).pathname;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

import { writeFileSync } from 'node:fs';

async function get(url, asJson = true) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': asJson ? 'application/json' : '*/*' } });
  if (!res.ok) { const e = new Error(`HTTP ${res.status} for ${url.split('?')[0]}`); e.status = res.status; throw e; }
  return asJson ? res.json() : res.text();
}

async function discoverClientId() {
  const pages = ['https://soundcloud.com/', 'https://soundcloud.com/discover', 'https://m.soundcloud.com/'];
  for (const pageUrl of pages) {
    let html;
    try { html = await get(pageUrl, false); }
    catch (e) { console.log(`discovery: ${pageUrl} → ${e.message}`); continue; }

    // Some pages inline the client_id directly
    const direct = html.match(/["']?client_id["']?\s*[:=]\s*["']([0-9a-zA-Z]{32})["']/);
    if (direct) { console.log(`discovery: inline client_id on ${pageUrl}`); return direct[1]; }

    const scripts = [...new Set([...html.matchAll(/["'](https:\/\/[^"']*sndcdn\.com\/[^"']+\.js)["']/g)].map(m => m[1]))];
    console.log(`discovery: ${pageUrl} → ${html.length} bytes, ${scripts.length} script candidates`);
    for (const src of scripts.reverse()) {
      try {
        const js = await get(src, false);
        const m = js.match(/client_id\s*[:=]\s*["']([0-9a-zA-Z]{32})["']/) || js.match(/client_id=([0-9a-zA-Z]{32})/);
        if (m) { console.log(`discovery: found in ${src.split('/').pop()}`); return m[1]; }
      } catch (e) { console.log(`discovery: ${src.split('/').pop()} → ${e.message}`); }
    }
    if (!scripts.length) console.log(`discovery: page head sample: ${html.slice(0, 300).replace(/\s+/g, ' ')}`);
  }
  throw new Error('Could not discover a client_id from soundcloud.com bundles');
}

let CID = null;
const api = (path, params = {}) => {
  const u = new URL(API + path);
  Object.entries({ client_id: CID, app_locale: 'en', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
};

async function paginate(firstUrl, maxItems, label) {
  const out = [];
  let url = firstUrl;
  while (url && out.length < maxItems) {
    const page = await get(url);
    out.push(...(page.collection || []));
    url = page.next_href ? page.next_href + (page.next_href.includes('client_id=') ? '' : `&client_id=${CID}`) : null;
  }
  console.log(`${label}: ${out.length}`);
  return out;
}

const trackLen = t => Math.max(t.full_duration || 0, t.duration || 0);
const slimTrack = t => ({
  id: t.id,
  title: t.title,
  artist: (t.user && t.user.username) || '',
  permalink: t.permalink_url,
  art: t.artwork_url || (t.user && t.user.avatar_url) || '',
  dur: trackLen(t),
  genre: t.genre || '',
  plays: t.playback_count || 0,
});

async function verifyCid(cid) {
  CID = cid;
  try { await get(api('/resolve', { url: PROFILE })); return true; }
  catch (e) { if (e.status === 401 || e.status === 403) return false; throw e; }
}

async function main() {
  const envCid = (process.env.SOUNDCLOUD_CLIENT_ID || '').trim();
  if (!envCid || !(await verifyCid(envCid))) {
    if (envCid) console.log('SOUNDCLOUD_CLIENT_ID not accepted by api-v2; falling back to discovery');
    CID = await discoverClientId();
    console.log('Using discovered web client_id');
  } else {
    console.log('Using SOUNDCLOUD_CLIENT_ID from environment');
  }

  const user = await get(api('/resolve', { url: PROFILE }));
  console.log(`Profile: ${user.username} (#${user.id})`);

  const likes = await paginate(api(`/users/${user.id}/track_likes`, { limit: 200 }), 800, 'likes');
  const reposts = await paginate(api(`/stream/users/${user.id}/reposts`, { limit: 200 }), 500, 'reposts');
  let playlists = [];
  try { playlists = await paginate(api(`/users/${user.id}/playlists_without_albums`, { limit: 50 }), 200, 'playlists'); }
  catch { playlists = await paginate(api(`/users/${user.id}/playlists`, { limit: 50 }), 200, 'playlists'); }
  let likedPls = [];
  try { likedPls = await paginate(api(`/users/${user.id}/playlist_likes`, { limit: 50 }), 200, 'liked playlists'); }
  catch {}

  const tracks = new Map();
  const touch = (t, source, when, extra) => {
    if (!t || t.kind !== 'track' || !t.id) return;
    const cur = tracks.get(t.id) || { ...slimTrack(t), sources: [] };
    if (trackLen(t) > cur.dur) cur.dur = trackLen(t);
    if (!cur.art && t.artwork_url) cur.art = t.artwork_url;
    cur.sources.push({ type: source, when: when ? Date.parse(when) : 0, ...(extra || {}) });
    tracks.set(t.id, cur);
  };

  likes.forEach(item => touch(item.track, 'like', item.created_at));
  reposts.forEach(item => {
    if (item.track) touch(item.track, 'repost', item.created_at);
    if (item.playlist) likedPls.push({ created_at: item.created_at, playlist: item.playlist, reposted: true });
  });

  const allPls = [
    ...playlists.map(p => ({ pl: p, rel: 'mine', when: p.created_at })),
    ...likedPls.map(x => ({ pl: x.playlist, rel: x.reposted ? 'reposted' : 'liked', when: x.created_at })),
  ].filter(x => x.pl && x.pl.id);

  // api-v2 returns id-only stubs for playlist tracks past the first few — hydrate them
  const stubIds = [...new Set(allPls.flatMap(({ pl }) => (pl.tracks || []).filter(t => !t.title).map(t => t.id)))].slice(0, 1000);
  const hydrated = new Map();
  for (let i = 0; i < stubIds.length; i += 50) {
    try {
      const batch = await get(api('/tracks', { ids: stubIds.slice(i, i + 50).join(',') }));
      batch.forEach(t => hydrated.set(t.id, t));
    } catch (e) { console.log(`hydration batch ${i / 50} failed: ${e.message}`); }
  }
  console.log(`playlist tracks hydrated: ${hydrated.size}/${stubIds.length}`);

  const plOut = [];
  const seenPl = new Set();
  allPls.forEach(({ pl, rel, when }) => {
    if (seenPl.has(pl.id)) return;
    seenPl.add(pl.id);
    (pl.tracks || []).forEach(t => {
      const full = t.title ? t : hydrated.get(t.id);
      if (full) touch(full, 'playlist', when || pl.created_at, { name: pl.title });
    });
    plOut.push({
      id: pl.id,
      title: pl.title,
      permalink: pl.permalink_url,
      art: pl.artwork_url || ((pl.tracks || []).find(t => t.artwork_url) || {}).artwork_url || '',
      count: pl.track_count || (pl.tracks || []).length,
      dur: pl.duration || 0,
      rel,
    });
  });

  const model = {
    user: { id: user.id, name: user.username, avatar: user.avatar_url },
    tracks: [...tracks.values()],
    playlists: plOut,
    syncedAt: Date.now(),
  };

  const HOUR = 3600000;
  const longMixes = model.tracks.filter(t => t.dur >= HOUR).length;
  console.log(`total tracks: ${model.tracks.length}, 1h+ mixes: ${longMixes}, playlists: ${model.playlists.length}`);
  if (!model.tracks.length) throw new Error('No tracks fetched — refusing to write empty data');

  writeFileSync(OUT, JSON.stringify(model));
  console.log(`wrote ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
