import {mount,today,shuffle,storage,el,link,safeURL,getJSON} from './shared.js';
mount('Deep Cuts',3,'The right record can change the shape of a day.');
const $=id=>document.getElementById(id);let tracks=[],picks=[],dig=0,saved=storage.get('music-saved',[]);
if(!Array.isArray(saved))saved=[];
function duration(ms){const m=Math.round(ms/60000);return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m} min`;}
function artwork(t){const img=el('img');img.alt=`Artwork for ${t.title}`;img.src=safeURL(t.art)||'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23533b43"/%3E%3Ccircle cx="100" cy="100" r="65" fill="%23242c3c"/%3E%3C/svg%3E';img.addEventListener('error',()=>{img.style.visibility='hidden';},{once:true});return img;}
function saveButton(t){
 const b=el('button','button');const update=()=>{const kept=saved.includes(t.id);b.textContent=kept?'Saved ✓':'Save this cut +';b.setAttribute('aria-pressed',String(kept));};update();
 b.addEventListener('click',()=>{saved=saved.includes(t.id)?saved.filter(id=>id!==t.id):[t.id,...saved].slice(0,100);const ok=storage.set('music-saved',saved);update();$('music-status').textContent=ok?'Record box updated.':'Kept for this visit. Browser storage is unavailable.';if($('mood').value==='saved')choose();});return b;
}
function renderTrack(t){
 $('listening-room').replaceChildren();const room=el('div','listening-room'),stage=el('div','album-stage');const record=el('span','record');record.setAttribute('aria-hidden','true');stage.append(record,artwork(t));room.append(stage);
 const info=el('div','track-info');info.append(el('p','label','On the turntable'),el('h2','',t.title),el('p','',`${t.artist} · ${duration(t.dur)}${t.genre?' · '+t.genre:''}`));
 const actions=el('div','actions'),play=el('button','button primary','▶ Press play');const player=el('div','player');player.hidden=true;
 play.addEventListener('click',()=>{if(player.hidden){const iframe=el('iframe');iframe.title=`SoundCloud player: ${t.title}`;iframe.allow='autoplay';iframe.src='https://w.soundcloud.com/player/?'+new URLSearchParams({url:t.permalink,auto_play:'true',hide_related:'true',show_comments:'false',show_user:'true',show_reposts:'false',color:'#c6ec9b'});player.append(iframe);player.hidden=false;play.textContent='Close player';}else{player.replaceChildren();player.hidden=true;play.textContent='▶ Press play';}});
 actions.append(play,saveButton(t),link('SoundCloud ↗',t.permalink,'button'));info.append(actions);room.append(info);$('listening-room').append(room,player);
 $('other-cuts').replaceChildren();for(const other of picks.filter(x=>x.id!==t.id)){
  const card=el('article','panel track-card');card.append(artwork(other));const text=el('div');text.append(el('h3','',other.title),el('p','small muted',`${other.artist} · ${duration(other.dur)}`));const b=el('button','button','Put it on ↗');b.addEventListener('click',()=>renderTrack(other));text.append(b);card.append(text);$('other-cuts').append(card);
 }
}
function choose(){
 const mood=$('mood').value;let pool=tracks;
 if(mood==='drift')pool=pool.filter(t=>/ambient|classical|soundtrack|chill|downtempo|piano/i.test(`${t.genre} ${t.title}`));
 if(mood==='move')pool=pool.filter(t=>/house|dance|techno|disco|bass|edm/i.test(`${t.genre} ${t.title}`));
 if(mood==='long')pool=pool.filter(t=>t.dur>=3600000);
 if(mood==='saved')pool=pool.filter(t=>saved.includes(t.id));
 picks=shuffle(pool,`${today}:${mood}:${dig}`).slice(0,3);
 $('other-heading').hidden=picks.length<2;
 if(!picks.length){$('listening-room').replaceChildren(el('p','empty',mood==='saved'?'Your saved record box is empty. Save a cut from another mood and come back here.':'No cuts in this mood yet. Try another mood.'));$('other-cuts').replaceChildren();return;}renderTrack(picks[0]);
}
async function load(){try{
 const data=await getJSON('/music-data.json');tracks=data.tracks.filter(t=>t.id&&t.title&&t.dur&&safeURL(t.permalink));if(!tracks.length)throw new Error('Empty record box');
 const synced=data.syncedAt?` · collection synced ${new Date(data.syncedAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}`:'';$('collection-status').textContent=`${tracks.length} cuts from my SoundCloud collection${synced}`;choose();
 }catch{$('collection-status').textContent='The record box is unavailable right now.';$('listening-room').replaceChildren(el('p','empty','Try reloading in a moment, or head to the full Music page.'));}}
$('mood').addEventListener('change',()=>{dig=0;choose();});$('dig').addEventListener('click',()=>{dig++;choose();});load();
