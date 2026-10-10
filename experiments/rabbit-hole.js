import {mount,today,hash,shuffle,storage,el,link,safeURL,getJSON} from './shared.js';
mount('Rabbit Hole',2,'Follow a link. Bring back a question.');
const $=id=>document.getElementById(id),base='https://hacker-news.firebaseio.com/v0/';
const questions=[
 'What would this look like if one person built it in a weekend?',
 'Which part of this feels like the future arriving a little early?',
 'What is everyone tolerating here that a tiny app could fix?',
 'Could this be calmer, simpler, or just a little more delightful?',
 'What would you make if you combined this with music?',
 'Which assumption would be fun to remove?',
 'What is the smallest useful version of this idea?',
 'Who would love this even if almost nobody else understood it?',
 'What would you try if you were allowed to be a beginner again?',
 'What would happen if this lived in the menu bar?',
 'Could you turn one idea from this into something you can touch?',
 'What would a version with only one button do?'
];
$('question').textContent=questions[hash(today)%questions.length];
let stories=[],showIDs=[],isEvergreen=false,saved=storage.get('rabbit-saved',[]);
if(!Array.isArray(saved))saved=[];
const evergreen=[
 {id:'swiftui',title:'A small native app starts with a view',url:'https://developer.apple.com/documentation/swiftui',label:'Apple · SwiftUI documentation'},
 {id:'canvas',title:'Make something strange with a canvas',url:'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API',label:'MDN · Canvas API'},
 {id:'three',title:'A little doorway into three dimensions',url:'https://threejs.org/',label:'Three.js · creative coding'},
 {id:'music',title:'A long mix is a good place to think',url:'https://ricburton.com/music.html',label:'Richard Burton · the music archive'},
 {id:'hn',title:'See what people are making right now',url:'https://news.ycombinator.com/show',label:'Hacker News · Show HN'}
];
function selection(){
 if(isEvergreen)return evergreen;
 const mode=$('mode').value;
 if(mode==='top')return stories.slice(0,5);
 if(mode==='builders'){const built=stories.filter(s=>showIDs.includes(s.id)||/^show hn:/i.test(s.title));return shuffle(built,`${today}:builders`).slice(0,5);}
 const ranked=stories.map((s,i)=>({s,score:(/build|software|design|music|open.source|space|browser|mac|app|creative|tool|program|code|small|visual|map|hack/i.test(s.title)?2:0)+(showIDs.includes(s.id)?1:0)+Math.max(0,30-i)/100})).sort((a,b)=>b.score-a.score);
 return shuffle(ranked.slice(0,20).map(x=>x.s),today).slice(0,5);
}
function render(){
 const picks=selection();$('stories').replaceChildren();
 if(!picks.length)$('stories').append(el('p','empty','Nothing here just yet. Try another view or refresh.'));
 picks.forEach((s,i)=>{
  const article=el('article','story');article.append(el('span','story-num',String(i+1).padStart(2,'0')));
  const body=el('div');const url=safeURL(s.url)||`https://news.ycombinator.com/item?id=${s.id}`;body.append(link(s.title,url,'story-title'));
  const meta=el('div','story-meta');if(s.label)meta.append(el('span','',s.label));else{
   meta.append(el('span','',new URL(url).hostname.replace(/^www\./,'')),el('span','',`${s.score||0} points`),link(`${s.descendants||0} comments`,`https://news.ycombinator.com/item?id=${s.id}`));
  }body.append(meta);article.append(body);
  const b=el('button','button',saved.some(x=>x.id===s.id)?'Saved ✓':'Save +');b.setAttribute('aria-label',`Save: ${s.title}`);b.setAttribute('aria-pressed',String(saved.some(x=>x.id===s.id)));
  b.addEventListener('click',()=>{const existing=saved.some(x=>x.id===s.id);saved=existing?saved.filter(x=>x.id!==s.id):[{id:s.id,title:s.title,url},...saved].slice(0,50);const ok=storage.set('rabbit-saved',saved);$('save-status').textContent=ok?(existing?'Removed from your saved links.':'Saved for later.'):'Saved for this visit. Browser storage is unavailable.';render();renderSaved();});article.append(b);$('stories').append(article);
 });
}
function renderSaved(){
 $('saved-count').textContent=`${saved.length} saved`;$('saved-links').replaceChildren();
 if(!saved.length)$('saved-links').append(el('p','small muted','Save a link above and it will be waiting here.'));
 for(const s of saved){const row=el('div','actions');row.append(link(s.title,s.url,'saved-link'));const b=el('button','button small','Remove');b.setAttribute('aria-label',`Remove saved link: ${s.title}`);b.addEventListener('click',()=>{saved=saved.filter(x=>x.id!==s.id);const ok=storage.set('rabbit-saved',saved);$('save-status').textContent=ok?'Removed from your saved links.':'Removed for this visit. Browser storage is unavailable.';renderSaved();render();});row.append(b);$('saved-links').append(row);}
}
async function load(force=false){
 $('refresh').disabled=true;const cache=storage.get('rabbit-cache',null);
 if(!force&&cache?.stories?.length&&Date.now()-cache.ts<3600000){stories=cache.stories;showIDs=cache.showIDs||[];isEvergreen=false;render();$('feed-status').textContent=`Latest saved feed · fetched ${new Date(cache.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;$('refresh').disabled=false;return;}
 $('feed-status').textContent='Finding fresh rabbit holes…';
 try{
  const results=await Promise.allSettled([getJSON(base+'topstories.json'),getJSON(base+'showstories.json')]);
  const tops=results[0].status==='fulfilled'?results[0].value.slice(0,30):[];showIDs=results[1].status==='fulfilled'?results[1].value.slice(0,15):[];
  const ids=[...new Set([...tops,...showIDs])];if(!ids.length)throw new Error('Feed unavailable');
  const items=await Promise.allSettled(ids.map(id=>getJSON(base+`item/${id}.json`)));
  stories=items.filter(r=>r.status==='fulfilled'&&r.value?.title&&!r.value.dead&&!r.value.deleted&&r.value.type==='story').map(r=>r.value);
  if(stories.length<5)throw new Error('Not enough stories');isEvergreen=false;storage.set('rabbit-cache',{stories,showIDs,ts:Date.now()});
  $('feed-status').textContent=`Fresh from Hacker News · fetched ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
 }catch{
  if(cache?.stories?.length){stories=cache.stories;showIDs=cache.showIDs||[];isEvergreen=false;$('feed-status').textContent=`Connection unavailable · saved feed from ${new Date(cache.ts).toLocaleString()}`;}
  else{isEvergreen=true;$('feed-status').textContent='Live feed unavailable · a few evergreen doors instead';}
 }finally{render();$('refresh').disabled=false;}
}
$('mode').addEventListener('change',render);$('refresh').addEventListener('click',()=>load(true));renderSaved();load();
