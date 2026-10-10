export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export const today = dayKey();
export function hash(text) { let h=2166136261; for (const c of String(text)) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
export function random(seed) { let a=hash(seed); return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
export function shuffle(items, seed) { const a=[...items],r=random(seed); for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`ric-experiments:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`ric-experiments:${key}`,JSON.stringify(value));return true; } catch { return false; } }
};
export function el(tag, className, text) { const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; }
export function safeURL(value) { try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;} }
export function link(text, url, className='') { const a=el('a',className,text);a.href=safeURL(url)||'#';a.target='_blank';a.rel='noopener noreferrer';return a; }
export async function getJSON(url, timeout=12000) { const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json(); }
export function mount(name, number, footerText='A little reason to come back tomorrow.') {
  const pages=[['Elsewhere','elsewhere'],['Rabbit Hole','rabbit-hole'],['Deep Cuts','deep-cuts'],['Tiny Ship','tiny-ship'],['Small Worlds','small-worlds']];
  const header=el('header','topbar');
  const brand=el('a','brand','Richard Burton');brand.href='/';brand.append(el('span','','/ experiments'));header.append(brand);
  const nav=el('nav','experiment-nav');nav.setAttribute('aria-label','Experiments');
  for(const [label,slug] of pages){const a=el('a','',label);a.href=`/experiments/${slug}.html`;if(label===name)a.setAttribute('aria-current','page');nav.append(a);}
  header.append(nav);document.body.prepend(header);
  const skip=el('a','skip','Skip to content');skip.href='#main';document.body.prepend(skip);
  const date=document.querySelector('[data-date]');if(date)date.textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date());
  const footer=el('footer','footer');const a=el('a','','All experiments ↗');a.href='/experiments/';footer.append(a,el('span','',footerText),el('span','mono',number?`No. ${String(number).padStart(2,'0')} / 05`:'An ongoing collection'));document.body.append(footer);
  const checkDay=()=>{if(!document.hidden&&dayKey()!==today)location.reload();};
  document.addEventListener('visibilitychange',checkDay);setInterval(checkDay,60000);
}
