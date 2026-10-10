import {mount,today,random,storage,el} from './shared.js';
mount('Tiny Ship',4,'An afternoon is plenty of time to start.');
const $=id=>document.getElementById(id),r=random(today+':ship');
const ideas=[
 ['A menu bar app that gives the day a soundtrack.','Pick one track, open it, and keep the controls out of the way.'],
 ['A tiny inbox for things you actually want to reply to.','Bring in three sample messages and make one satisfying reply flow.'],
 ['A focus timer that feels like watching a tide come in.','Start a short session, let the scene change, and make the finish feel calm.'],
 ['A postcard from your favourite webcam.','Show a real view, its local time, and a way to keep the moment.'],
 ['A music queue for a very specific walk.','Choose a mood, build a three-track queue, and start the first track.'],
 ['A tiny map of places you would take a friend.','Add three places, a sentence about each, and one route between them.'],
 ['A launcher that opens exactly the right three things.','Make a named ritual that opens a few apps or links with one click.'],
 ['A weather app that answers “should I go outside?”','Show the forecast and one very clear suggestion, with a link to the source.'],
 ['A place to keep the best sentence you read today.','Save one sentence with its source, then let yesterday gently step aside.'],
 ['A desktop companion that reacts to your music.','Make a little character respond to a beat or a volume slider.'],
 ['A pocket-sized flight board for imaginary adventures.','Let someone pick three destinations and put them on a beautiful little board.'],
 ['A one-button instrument that sounds different every day.','Generate a pleasant sound, let it respond to a click, and add a mute control.'],
 ['A little garden that grows when you finish something.','Add a task, mark it done, and see one new leaf appear.'],
 ['A search box for a collection you keep forgetting about.','Use ten real items and make finding one feel instant and obvious.'],
 ['A tiny photo painter that gives every day a new palette.','Let someone choose three colours, make a mark, and save the picture.'],
 ['A weekend idea shelf with no infinite scrolling.','Keep five ideas, pick one, and make the first next step visible.'],
 ['A really nice way to archive something.','Use sample items, give one a satisfying send-off, and make undo easy.'],
 ['A “where is it golden hour?” world clock.','Choose three places and make their local light easy to compare.'],
 ['A notebook for moments in the middle of a song.','Save a timestamp, a track link, and one sentence, then find it again.'],
 ['A silly status bar for a very serious project.','Take three made-up project states and give each a tiny animated personality.']
];
const constraints=[
 'The whole thing must fit inside a single small window.',
 'There is only one primary button. Make it earn its place.',
 'It must still be useful without an account or a server.',
 'Every action should also work from the keyboard.',
 'You get just three colours and one typeface.',
 'No settings page. Pick thoughtful defaults.',
 'Explain the whole thing in one sentence on the first screen.',
 'Make the useful part work before adding an animation.',
 'It must feel good with the sound off and motion reduced.',
 'Imagine someone only has thirty seconds. Respect those seconds.',
 'Keep every bit of state in a plain little local file or browser storage.',
 'Make a version your friend could try without you explaining it.'
];
const delights=[
 'A tiny animation that celebrates one small success.',
 'A colour palette that follows the time of day.',
 'A surprisingly good empty state.',
 'One keyboard shortcut that feels obvious once you discover it.',
 'A gentle sound you can turn off.',
 'A shareable postcard at the end.',
 'A delightfully precise piece of microcopy.',
 'A little visual detail borrowed from an old piece of hardware.',
 'A small creature that appears when the work is done.',
 'A beautiful transition between “nothing yet” and “something here”.',
 'A detail that rewards looking twice.',
 'An undo action that makes experimentation feel easy.'
];
const idea=ideas[Math.floor(r()*ideas.length)],constraint=constraints[Math.floor(r()*constraints.length)],delight=delights[Math.floor(r()*delights.length)];
$('brief-number').textContent=today;$('brief-title').textContent=idea[0];$('brief-constraint').textContent=constraint;$('brief-delight').textContent=delight;$('brief-done').textContent=idea[1];
let log=storage.get('ship-log',[]);if(!Array.isArray(log))log=[];let notes=storage.get('ship-notes',{});if(!notes||typeof notes!=='object'||Array.isArray(notes))notes={};
$('note').value=notes[today]||'';
function render(){const done=log.some(x=>x.day===today);$('ship').textContent=done?'Shipped ✓ · undo':'I shipped it ↗';$('ship').setAttribute('aria-pressed',String(done));$('ship-count').textContent=String(log.length);$('ship-log').replaceChildren();
 const previous=log.filter(x=>x.day!==today).slice(0,5);if(!previous.length)$('ship-log').append(el('p','small muted','A clean slate. A good place to start.'));
 for(const item of previous){const row=el('div','log-line');row.append(el('strong','',item.day),el('span','',item.title));$('ship-log').append(row);}
}
$('ship').addEventListener('click',()=>{const done=log.some(x=>x.day===today);log=done?log.filter(x=>x.day!==today):[{day:today,title:idea[0]},...log].slice(0,366);const ok=storage.set('ship-log',log);$('brief-status').textContent=ok?(done?'Back on the workbench.':'One more little thing in the world. Nice.'):'Updated for this visit. Browser storage is unavailable.';render();});
$('note').addEventListener('input',()=>{notes[today]=$('note').value;const keys=Object.keys(notes).sort().reverse();notes=Object.fromEntries(keys.slice(0,90).map(k=>[k,notes[k]]));$('note-status').textContent=storage.set('ship-notes',notes)?'Saved in this browser.':'Browser storage is unavailable. Copy your notes before leaving.';});
$('copy').addEventListener('click',async()=>{const brief=`Tiny Ship · ${today}\n\n${idea[0]}\n\nThe constraint: ${constraint}\nThe delightful detail: ${delight}\nDone means: ${idea[1]}`;try{await navigator.clipboard.writeText(brief);$('brief-status').textContent='Brief copied. Go make a little something.';}catch{const text=el('textarea');text.readOnly=true;text.value=brief;text.setAttribute('aria-label','Brief to copy');$('brief-status').replaceChildren(el('span','','Select and copy the brief below.'),text);text.focus();text.select();}});render();
