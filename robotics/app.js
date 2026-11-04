import {pacificDay,addDays,formatDay,daysOld,statusOf,filterEvents,eventsOnDay,calendarDays,toICS} from './model.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, now = new Date(), month = pacificDay().slice(0,7), selectedDay = pacificDay(), view='list', loading=false;
const filters = {query:'',region:'all',type:'all',range:'upcoming',savedOnly:false};
let saved = new Set();
try { const stored=JSON.parse(localStorage.getItem('robotics-saved') || '[]'); if(Array.isArray(stored)) saved=new Set(stored.filter(x=>typeof x==='string')); } catch {}
let toastTimer;
let lastToday = pacificDay();
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,3500); }
function dateRange(e) { const start=formatDay(e.startDate,{month:'short',day:'numeric'}); return e.endDate === e.startDate ? start : `${start}–${formatDay(e.endDate,{month:e.endDate.slice(0,7)!==e.startDate.slice(0,7)?'short':undefined,day:'numeric'})}`; }
function eventCard(e,compact=false) {
  const status=statusOf(e,now), isSaved=saved.has(e.id), freshness=daysOld(e.verified,pacificDay(now));
  return `<article class="event-card" id="${compact?'day-':''}${esc(e.id)}" aria-labelledby="${compact?'day-':''}title-${esc(e.id)}">
    <div class="date-block" aria-label="${esc(dateRange(e))}"><span class="day-name">${formatDay(e.startDate,{weekday:'short'}).toUpperCase()}</span><span class="day-number">${formatDay(e.startDate,{day:'numeric'})}</span><span class="date-month">${formatDay(e.startDate,{month:'short'})}${e.endDate !== e.startDate ? ' – '+formatDay(e.endDate,{day:'numeric',month:'short'}) : ''}</span></div>
    <div class="event-content"><div class="card-eyebrow"><span class="tag" data-type="${esc(e.type)}">${esc(e.type)}</span><span>${esc(e.city)}</span>${status !== 'Upcoming'?`<span class="${status==='Past'?'past-badge':'live-badge'}">${status}</span>`:''}</div>
    <h3 id="${compact?'day-':''}title-${esc(e.id)}"><a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a></h3>
    <div class="event-meta"><span>◷ ${esc(e.schedule)}</span><span>⌖ ${esc(e.venue || 'Venue to be announced')}</span></div>
    <p class="event-description">${esc(e.description)}</p>${e.notes?`<p class="event-note">${esc(e.notes)}</p>`:''}
    <div class="event-bottom"><span>${esc(e.admission)}</span><a class="source-link" href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a><span>${freshness>7?'Review '+freshness+' days old · ':''}Checked ${formatDay(e.verified,{month:'short',day:'numeric',year:'numeric'})}</span><button class="ics-button" type="button" data-download="${esc(e.id)}">Add to calendar</button></div></div>
    <div class="card-actions"><button type="button" class="save-button" aria-pressed="${isSaved}" aria-label="${isSaved?'Unsave':'Save'} ${esc(e.title)}" data-save="${esc(e.id)}">${isSaved?'♥':'♡'}</button><a class="details-link" href="${esc(e.registration || e.source)}" target="_blank" rel="noopener noreferrer">${e.action || 'Details & RSVP'} ↗</a></div>
    </article>`;
}
function empty(message) { return `<div class="empty">${message}</div>`; }
function render() {
  if(!data) return;
  now=new Date(); const today=pacificDay(now), events=filterEvents(data.events,filters,now,saved);
  if(today !== lastToday) {
    if(selectedDay === lastToday) selectedDay=today;
    if(month === lastToday.slice(0,7)) month=today.slice(0,7);
    lastToday=today;
  }
  $('#today-label').textContent=formatDay(today,{month:'short',day:'numeric',year:'numeric'});
  $('#week-count').textContent=filterEvents(data.events,{range:'week'},now).length;
  $('#total-count').textContent=filterEvents(data.events,{range:'upcoming'},now).length;
  $('#verified-date').textContent=formatDay(data.lastReviewed,{month:'short',day:'numeric',year:'numeric'});
  $('#coverage').textContent=`${data.events.length} listings · ${data.coverage} · Curated, not exhaustive.`;
  $('#results-count').textContent=`${events.length} ${events.length===1?'event':'events'}${filters.savedOnly?' saved':''}${view==='calendar'?' across all months · '+events.filter(e=>e.startDate.slice(0,7)<=month && e.endDate.slice(0,7)>=month).length+' this month':''}`;
  const stale=daysOld(data.lastReviewed,today); $('#freshness').hidden=stale<=7;
  $('#freshness').textContent=`Sources were last reviewed ${stale} days ago. These listings may have changed. Confirm dates, admission and venues with the organizers.`;
  let previousMonth='';
  $('#event-list').innerHTML=events.length?events.map(e=>{
    const m=e.startDate.slice(0,7), header=m!==previousMonth?`<h3 class="month-group">${formatDay(e.startDate,{month:'long',year:'numeric'}).toUpperCase()}</h3>`:''; previousMonth=m; return header+eventCard(e);
  }).join(''):empty('No events match these filters. Try another region, format, or date range.');
  renderCalendar(events);
}
function renderCalendar(events) {
  const today=pacificDay(now);
  $('#month-label').textContent=formatDay(`${month}-01`,{month:'long',year:'numeric'});
  $('#calendar-grid').innerHTML=calendarDays(month).map(day=>{
    const items=eventsOnDay(events,day), label=`${formatDay(day,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}, ${items.length} ${items.length===1?'event':'events'}`;
    return `<button type="button" class="calendar-day ${day.slice(0,7)!==month?'other-month':''} ${day===today?'today':''} ${items.length?'has-events':''}" data-day="${day}" aria-label="${label}" aria-pressed="${day===selectedDay}" ${day===today?'aria-current="date"':''}><span class="cal-number">${Number(day.slice(8))}</span>${items.length?`<span class="cal-events">${items.length} ${items.length===1?'event':'events'}<span class="cal-title">${esc(items[0].title)}</span></span>`:''}</button>`;
  }).join('');
  $('#selected-day').textContent=formatDay(selectedDay,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
  const selected=eventsOnDay(events,selectedDay);
  $('#day-events').innerHTML=selected.length?selected.map(e=>eventCard(e,true)).join(''):empty('No matching events listed for this day. Choose a highlighted date, or change your filters.');
}
async function load(manual=false) {
  if(loading) return; loading=true; $('#reload').disabled=true;
  try {
    const response=await fetch('./events.json',{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const incoming=await response.json();
    if(!Array.isArray(incoming.events) || !incoming.lastReviewed) throw new Error('Invalid listing data');
    data=incoming; render();
    if(manual) { $('#reload-status').textContent='Latest published listings loaded. Source review: '+formatDay(data.lastReviewed,{month:'short',day:'numeric',year:'numeric'})+'.'; toast('Latest published listings loaded.'); }
  } catch {
    if(!data) {$('#event-list').innerHTML=empty('Listings could not load. Use “Reload listings” below to try again, or visit the organizer links.');$('#results-count').textContent='Listings unavailable';$('#coverage').textContent='A curated index of Bay Area robotics events.';$('#verified-date').textContent='Unavailable';}
    $('#reload-status').textContent='Could not reload listings. Check your connection and try again.';
  } finally { loading=false; $('#reload').disabled=false; }
}
function setView(next) {
  view=next; $('#list-view').setAttribute('aria-pressed',next==='list'); $('#calendar-view').setAttribute('aria-pressed',next==='calendar');
  $('#list-panel').hidden=next!=='list'; $('#calendar-panel').hidden=next!=='calendar'; render();
}
$('#list-view').addEventListener('click',()=>setView('list')); $('#calendar-view').addEventListener('click',()=>setView('calendar'));
$('#search').addEventListener('input',event=>{filters.query=event.target.value; render();});
for(const field of ['region','type']) $('#'+field).addEventListener('change',event=>{filters[field]=event.target.value;render();});
$('#saved-only').addEventListener('change',event=>{filters.savedOnly=event.target.checked;render();});
function setRange(range){filters.range=range;document.querySelectorAll('[data-range]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.range===range));}
document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{setRange(button.dataset.range);if(filters.range==='week'){month=pacificDay().slice(0,7);selectedDay=pacificDay();}render();}));
$('#reset').addEventListener('click',()=>{Object.assign(filters,{query:'',region:'all',type:'all',savedOnly:false});$('#search').value='';$('#region').value='all';$('#type').value='all';$('#saved-only').checked=false;setRange('upcoming');render();});
function changeMonth(delta) { const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+delta);month=date.toISOString().slice(0,7);selectedDay=`${month}-01`;render(); }
$('#prev-month').addEventListener('click',()=>changeMonth(-1));$('#next-month').addEventListener('click',()=>changeMonth(1));$('#this-month').addEventListener('click',()=>{selectedDay=pacificDay();month=selectedDay.slice(0,7);render();});
$('#calendar-grid').addEventListener('click',event=>{const button=event.target.closest('[data-day]');if(!button)return;selectedDay=button.dataset.day;month=selectedDay.slice(0,7);render();$('#calendar-grid [data-day="'+selectedDay+'"]').focus({preventScroll:true});});
$('#calendar-grid').addEventListener('keydown',event=>{const button=event.target.closest('[data-day]');if(!button)return;const delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}[event.key];if(delta===undefined)return;event.preventDefault();selectedDay=addDays(button.dataset.day,delta);month=selectedDay.slice(0,7);render();$('#calendar-grid [data-day="'+selectedDay+'"]').focus({preventScroll:true});});
document.addEventListener('click',event=>{
  const saveButton=event.target.closest('[data-save]');
  if(saveButton){const id=saveButton.dataset.save; saved.has(id)?saved.delete(id):saved.add(id);let persisted=true;try{localStorage.setItem('robotics-saved',JSON.stringify([...saved]));}catch{persisted=false;}const inDay=!!saveButton.closest('#day-events');render();document.querySelector(`${inDay?'#day-events':'#event-list'} [data-save="${id}"]`)?.focus({preventScroll:true});toast(persisted?(saved.has(id)?'Saved in this browser. RSVP with the organizer.':'Removed from your saved events.'):'Saved for this visit. Browser storage is unavailable.');}
  const download=event.target.closest('[data-download]');if(download){const item=data.events.find(e=>e.id===download.dataset.download);const url=URL.createObjectURL(new Blob([toICS([item])],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=item.id+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
$('#reload').addEventListener('click',()=>load(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
setInterval(()=>{if(!document.hidden)render();},60000);
load();
