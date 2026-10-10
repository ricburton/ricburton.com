import {mount,today,hash,el,storage,getJSON} from './shared.js';
mount('Elsewhere',1,'A small reminder that the world keeps going.');
const places=[
 {id:'ocean',name:'Ocean Beach',region:'San Francisco · Pacific edge',lat:37.76,lon:-122.51,zone:'America/Los_Angeles',note:'Imagine a coffee, a long stretch of sand, and no particular destination.',links:[['Watch the coast','/webcams.html'],['Go exploring','/navigator.html']]},
 {id:'norfolk',name:'Wells-next-the-Sea',region:'Norfolk · North Sea edge',lat:52.956,lon:.851,zone:'Europe/London',note:'A little harbour. A very big sky. A good place to remember how slowly a tide can move.',links:[['Watch the harbour','/norfolk.html'],['Harbour camera ↗','https://www.portofwells.co.uk/webcam/']]},
 {id:'london',name:'London',region:'England · beside the Thames',lat:51.507,lon:-.128,zone:'Europe/London',note:'Take the longer route. Pick a bridge, cross it, and look at the city from the other side.',links:[['Find something nearby','/navigator.html'],['Explore the map ↗','https://www.openstreetmap.org/#map=13/51.507/-0.128']]},
 {id:'reykjavik',name:'Reykjavík',region:'Iceland · North Atlantic edge',lat:64.147,lon:-21.943,zone:'Atlantic/Reykjavik',note:'Steam rising into cold air. Leave a little room in the day for a hot pool and a strange idea.',links:[['Explore the map ↗','https://www.openstreetmap.org/#map=13/64.147/-21.943']]},
 {id:'kyoto',name:'Kyoto',region:'Japan · between the mountains',lat:35.011,lon:135.768,zone:'Asia/Tokyo',note:'One quiet side street. One small garden. A reminder that the details are sometimes the whole point.',links:[['Explore the map ↗','https://www.openstreetmap.org/#map=13/35.011/135.768']]}
];
let selected=places[hash(today)%places.length],sequence=0,weather=null;
const $=id=>document.getElementById(id);
const buttons=new Map();
for(const p of places){const b=el('button','button',p.name);b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>select(p));$('places').append(b);buttons.set(p.id,b);}
function clock(){
 const now=new Date();$('clock').textContent=new Intl.DateTimeFormat(undefined,{timeZone:selected.zone,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now)+' local time';
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:selected.zone,hour:'2-digit',hour12:false}).format(now));
 $('window').classList.toggle('night',weather ? !weather.current.is_day : hour<7||hour>=19);
 if(weather){const rise=weather.daily.sunrise[0]*1000,set=weather.daily.sunset[0]*1000;$('sun-progress').style.width=`${Math.max(0,Math.min(100,(Date.now()-rise)/(set-rise)*100))}%`;}
}
function select(p){
 selected=p;weather=null;for(const [id,b]of buttons)b.setAttribute('aria-pressed',String(id===p.id));
 $('place-name').textContent=p.name;$('place-region').textContent=p.region;$('place-note').textContent=p.note;$('place-links').replaceChildren();
 for(const [name,url]of p.links){const a=el('a','button',name);a.href=url;if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}$('place-links').append(a);}
 for(const id of ['temperature','conditions','wind'])$(id).textContent='—';$('daylight').textContent='Waiting for the sun times…';$('sunrise').textContent='Sunrise —';$('sunset').textContent='Sunset —';$('sun-progress').style.width='0%';clock();loadWeather();
}
function describe(code){if(code===0)return 'Clear';if(code<=2)return 'Partly cloudy';if(code===3)return 'Cloudy';if(code<=48)return 'Fog';if(code<=57)return 'Drizzle';if(code<=67)return 'Rain';if(code<=77)return 'Snow';if(code<=82)return 'Showers';if(code<=86)return 'Snow showers';return 'Thunderstorm';}
function show(data,p,cached=false){
 if(!data.current||!data.daily?.sunrise?.length)throw new Error('Incomplete forecast');weather=data;
 $('temperature').textContent=String(Math.round(data.current.temperature_2m))+'°';$('conditions').textContent=describe(data.current.weather_code);$('wind').textContent=String(Math.round(data.current.wind_speed_10m));
 const time=stamp=>new Intl.DateTimeFormat(undefined,{timeZone:p.zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(stamp*1000));
 const length=data.daily.daylight_duration[0];$('daylight').textContent=`${Math.floor(length/3600)} hours, ${Math.round(length%3600/60)} minutes between sunrise and sunset`;
 $('sunrise').textContent='Sunrise '+time(data.daily.sunrise[0]);$('sunset').textContent='Sunset '+time(data.daily.sunset[0]);
 const observed=new Intl.DateTimeFormat(undefined,{timeZone:p.zone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.current.time*1000));
 $('weather-status').textContent=`${cached?'Saved forecast · connection unavailable':'Open-Meteo forecast'} · ${observed} local time`;clock();
}
async function loadWeather(){
 const p=selected,seq=++sequence;$('refresh').disabled=true;$('weather-status').textContent='Fetching the forecast…';
 try{
  const params=new URLSearchParams({latitude:p.lat,longitude:p.lon,current:'temperature_2m,weather_code,wind_speed_10m,is_day',daily:'sunrise,sunset,daylight_duration',timezone:p.zone,forecast_days:'1',timeformat:'unixtime'});
  const data=await getJSON(`https://api.open-meteo.com/v1/forecast?${params}`);
  if(seq!==sequence)return;show(data,p);storage.set('weather-'+p.id,{data,ts:Date.now()});
 }catch{
  if(seq!==sequence)return;const saved=storage.get('weather-'+p.id,null);
  if(saved&&Date.now()-saved.ts<3*3600000){try{show(saved.data,p,true);}catch{$('weather-status').textContent='Weather is unavailable. The real world is still out there; try the camera links.';}}
  else $('weather-status').textContent='Weather is unavailable. Try again in a moment, or open a camera.';
 }finally{if(seq===sequence)$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',loadWeather);select(selected);setInterval(clock,1000);
