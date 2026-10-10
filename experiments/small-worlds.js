import {mount,today,random,storage,el} from './shared.js';
mount('Small Worlds',5,'A postcard from a place that only exists here.');
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d');
const themes=[
 {kind:'An ocean world',water:[30,69,104],land:[134,165,136],high:[203,214,169],sand:[217,202,166],sky:'#101a2a',story:'Somewhere on that little coastline, an imaginary person is wondering what is on the other side of the sea.'},
 {kind:'A rust-coloured wanderer',water:[81,50,76],land:[190,111,84],high:[233,182,132],sand:[219,159,121],sky:'#211324',story:'The maps here are unfinished. There are probably beautiful rocks, very long sunsets, and absolutely no unread emails.'},
 {kind:'A quiet ice moon',water:[39,77,98],land:[158,188,194],high:[224,232,220],sand:[192,219,213],sky:'#112333',story:'A pale moon with slow seas. The sort of place where you would take a long walk and forget what time it was.'},
 {kind:'An archipelago after dusk',water:[42,47,93],land:[143,127,170],high:[221,176,170],sand:[228,202,179],sky:'#1c1733',story:'Each island has a different song. Nobody has made a playlist of all of them yet. That might be your job.'},
 {kind:'A green little daydream',water:[29,76,75],land:[114,158,105],high:[210,212,147],sand:[210,192,146],sky:'#112727',story:'There is a small cabin on one of those islands. It has a good view, a kettle, and a suspiciously good internet connection.'}
];
const first=['Soft','Low','Far','Little','Quiet','Velvet','Pale','Hidden','Slow','Silver','Amber','Afterglow','Blue','Wild','Wandering','Last'];
const last=['Harbour','Orbit','Sunday','Tide','Radio','Island','Echo','Morning','Lantern','Garden','Drift','Signal','Moon','Window','Summer','Horizon'];
let seed=today,world,angle=0,tide=.5,turning=false,extra=0,kept=storage.get('worlds',[]),lastFrame=0,animation=0;
if(!Array.isArray(kept))kept=[];
const texture=document.createElement('canvas');texture.width=340;texture.height=340;const tctx=texture.getContext('2d');
function makeWorld(value){const r=random(value);return {seed:value,name:`${first[Math.floor(r()*first.length)]} ${last[Math.floor(r()*last.length)]}`,theme:themes[Math.floor(r()*themes.length)],phases:Array.from({length:6},()=>r()*Math.PI*2),stars:Array.from({length:95},()=>({x:r(),y:r(),r:r()*1.3+.4,alpha:r()*.6+.2})),moonX:r()*.2+.76,moonY:r()*.25+.23};}
function terrain(lon,lat){const p=world.phases;
 return .5+.16*Math.sin(lon*2+p[0])*Math.cos(lat*3+p[1])+.12*Math.sin(lon*3-lat*4+p[2])+.09*Math.cos(lon*5+lat*2+p[3])+.055*Math.sin(lon*9-lat*7+p[4])+.025*Math.cos(lon*17+lat*13+p[5]);
}
function paintSphere(){const n=texture.width,image=tctx.createImageData(n,n),d=image.data,theme=world.theme,rotation=angle*Math.PI/180;
 for(let y=0;y<n;y++){const ny=(y+.5-n/2)/(n/2);for(let x=0;x<n;x++){
  const nx=(x+.5-n/2)/(n/2),sq=nx*nx+ny*ny;if(sq>1)continue;const z=Math.sqrt(1-sq),lon=Math.atan2(nx,z)+rotation,lat=Math.asin(-ny),height=terrain(lon,lat),land=height>tide;
  const altitude=Math.max(0,Math.min(1,(height-tide)/.33)),coast=Math.abs(height-tide)<.012;
  let color=land?theme.land:theme.water;if(coast)color=theme.sand;
  const light=Math.max(.12,-nx*.53-ny*.35+z*.76),shade=.25+.8*light,contour=land&&Math.floor(height*75)%3===0?.91:1;
  const index=(y*n+x)*4;for(let c=0;c<3;c++){const base=land&&!coast?color[c]*(1-altitude)+theme.high[c]*altitude:color[c];d[index+c]=Math.min(255,base*shade*contour);}d[index+3]=Math.min(255,(1-sq)*n*255);
 }}tctx.putImageData(image,0,0);
}
function scene(context,w,h,postcard=false){
 const theme=world.theme;context.fillStyle='#080d19';context.fillRect(0,0,w,h);const bg=context.createRadialGradient(w*.48,h*.5,0,w*.48,h*.5,w*.7);bg.addColorStop(0,theme.sky);bg.addColorStop(1,'#080d19');context.fillStyle=bg;context.fillRect(0,0,w,h);
 for(const s of world.stars){context.fillStyle=`rgba(209,226,234,${s.alpha})`;context.beginPath();context.arc(s.x*w,s.y*h,s.r*(w/1000+.4),0,Math.PI*2);context.fill();}
 const radius=Math.min(w*.29,h*.37),cx=w*.5,cy=h*.52;
 context.save();context.translate(cx,cy);context.rotate(-.22);context.strokeStyle='#afc6d026';context.lineWidth=1;context.beginPath();context.ellipse(0,0,radius*1.55,radius*.4,0,0,Math.PI*2);context.stroke();context.restore();
 const glow=context.createRadialGradient(cx,cy,radius*.85,cx,cy,radius*1.28);glow.addColorStop(0,'#a5d1e82b');glow.addColorStop(1,'#a5d1e800');context.fillStyle=glow;context.beginPath();context.arc(cx,cy,radius*1.28,0,Math.PI*2);context.fill();context.drawImage(texture,cx-radius,cy-radius,radius*2,radius*2);
 const moonR=radius*.08,mx=w*world.moonX,my=h*world.moonY;const moon=context.createRadialGradient(mx-moonR*.4,my-moonR*.4,0,mx,my,moonR);moon.addColorStop(0,'#e4ddd0');moon.addColorStop(.5,'#999a9e');moon.addColorStop(1,'#262e40');context.fillStyle=moon;context.beginPath();context.arc(mx,my,moonR,0,Math.PI*2);context.fill();
 context.strokeStyle='#d6e2e52a';context.beginPath();context.moveTo(26,h-35);context.lineTo(58,h-35);context.moveTo(42,h-51);context.lineTo(42,h-19);context.stroke();
 context.fillStyle='#c3d0dc';context.font=`${Math.max(10,w*.0105)}px ui-monospace, monospace`;context.textAlign='right';context.fillText(`SEA ${Math.round(tide*100)} / TURN ${Math.round(angle)}°`,w-23,h-29);
 if(postcard){context.textAlign='left';context.fillStyle='#f3f3ee';context.font='36px -apple-system, system-ui, sans-serif';context.fillText(world.name,55,75);context.fillStyle='#acb7c5';context.font='17px ui-monospace, monospace';context.fillText(`${world.theme.kind} · ${seed}`,55,110);context.fillText('SMALL WORLDS / RICBURTON.COM',55,h-36);}
}
function draw(retexture=true){if(retexture)paintSphere();const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);scene(ctx,w,h);}
function load(value,rotation=0,sea=.5){seed=value;world=makeWorld(seed);angle=rotation;tide=sea;$('rotation').value=String(angle);$('tide').value=String(tide*100);$('world-name').textContent=world.name;$('world-coordinate').textContent=`FIELD NOTES / ${seed}`;$('world-kind').textContent=world.theme.kind;$('world-story').textContent=world.theme.story;canvas.setAttribute('aria-label',`${world.name}, ${world.theme.kind.toLowerCase()}, with procedural oceans, continents and a small moon. Use the sliders to rotate it or change the sea level.`);draw();}
function shelf(){
 $('world-shelf').replaceChildren();if(!kept.length)$('world-shelf').append(el('p','small muted','Keep a world and it will be waiting here.'));
 for(const item of kept){const row=el('div','actions');const b=el('button','button',item.name+' ↗');b.addEventListener('click',()=>load(item.seed,item.angle,item.tide));const remove=el('button','button','×');remove.setAttribute('aria-label',`Remove ${item.name} from kept worlds`);remove.addEventListener('click',()=>{kept=kept.filter(x=>x.seed!==item.seed);const ok=storage.set('worlds',kept);$('world-status').textContent=ok?'World removed from your collection.':'Removed for this visit. Browser storage is unavailable.';shelf();});row.append(b,remove);$('world-shelf').append(row);}
}
$('rotation').addEventListener('input',()=>{angle=Number($('rotation').value);draw();});$('tide').addEventListener('input',()=>{tide=Number($('tide').value)/100;draw();});
function frame(time){if(!turning)return;if(!document.hidden&&time-lastFrame>140){angle=(angle+.5)%360;$('rotation').value=String(Math.round(angle));draw();lastFrame=time;}animation=requestAnimationFrame(frame);}
$('orbit').addEventListener('click',()=>{turning=!turning;$('orbit').textContent=turning?'Pause the orbit':'Let it turn';$('orbit').setAttribute('aria-pressed',String(turning));if(turning)animation=requestAnimationFrame(frame);else cancelAnimationFrame(animation);});
$('next-world').addEventListener('click',()=>{extra++;load(`${today}:${extra}`);});$('today-world').addEventListener('click',()=>load(today));
$('keep-world').addEventListener('click',()=>{kept=[{seed,name:world.name,angle,tide},...kept.filter(x=>x.seed!==seed)].slice(0,24);const ok=storage.set('worlds',kept);$('world-status').textContent=ok?`${world.name} is in your little universe.`:'Kept for this visit. Browser storage is unavailable.';shelf();});
$('postcard').addEventListener('click',()=>{const output=document.createElement('canvas');output.width=1920;output.height=1080;scene(output.getContext('2d'),1920,1080,true);output.toBlob(blob=>{if(!blob){$('world-status').textContent='The postcard could not be saved. Try again.';return;}const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`small-worlds-${seed.replace(/:/g,'-')}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('world-status').textContent=`Postcard of ${world.name} downloaded.`;},'image/png');});
new ResizeObserver(()=>draw(false)).observe(canvas);load(today);shelf();
