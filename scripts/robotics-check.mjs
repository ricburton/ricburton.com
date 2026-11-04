import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {pacificDay,toICS} from '../robotics/model.mjs';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('robotics/events.json',root),'utf8'));
const date=/^\d{4}-\d{2}-\d{2}$/;
const types=['Meetup','Hackathon','Workshop','Research','Conference','Competition'];
assert.equal(data.timeZone,'America/Los_Angeles');
assert(date.test(data.lastReviewed));
const ids=new Set(), duplicate=new Set();
for(const e of data.events) {
  for(const key of ['id','title','startDate','endDate','city','region','type','organizer','venue','description','source','schedule','admission','verified','status']) assert(e[key],`${e.id}: missing ${key}`);
  assert(/^[a-z0-9-]+$/.test(e.id));assert(!ids.has(e.id),`Duplicate ID: ${e.id}`);ids.add(e.id);
  const pair=e.title.toLowerCase()+'|'+e.startDate;assert(!duplicate.has(pair),`Duplicate listing: ${pair}`);duplicate.add(pair);
  assert(types.includes(e.type));assert(['San Francisco','East Bay','South Bay','Peninsula','North Bay'].includes(e.region));
  assert(['scheduled','cancelled'].includes(e.status));
  for(const d of [e.startDate,e.endDate,e.verified]){assert(date.test(d));assert.equal(new Date(d+'T12:00:00Z').toISOString().slice(0,10),d);}
  assert(e.endDate>=e.startDate);assert(e.verified<=data.lastReviewed);
  for(const u of [e.source,e.registration,...(e.additionalSources||[])].filter(Boolean)) assert.equal(new URL(u).protocol,'https:');
  assert.equal(!!e.start,!!e.end,`${e.id}: timed listings need both start and end`);
  if(e.start){for(const t of [e.start,e.end])assert(/(Z|[+-]\d\d:\d\d)$/.test(t));assert(new Date(e.end)>new Date(e.start));assert.equal(pacificDay(new Date(e.start)),e.startDate);assert.equal(pacificDay(new Date(new Date(e.end).valueOf()-1)),e.endDate);}
}
const ics=toICS(data.events);
assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,data.events.length);
for(const line of ics.split('\r\n'))assert(Buffer.byteLength(line)<=75,'ICS line exceeds 75 octets');
const dest=new URL('robotics/events.ics',root);
if(process.argv.includes('--write')){await writeFile(dest,ics);console.log('Wrote '+fileURLToPath(dest));}
else assert.equal(await readFile(dest,'utf8'),ics,'Calendar differs from data; run node scripts/robotics-check.mjs --write');
console.log(`Validated ${data.events.length} listings, unique IDs, dates, URLs, Pacific offsets, and calendar parity.`);
