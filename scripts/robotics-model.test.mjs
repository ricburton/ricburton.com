import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pacificDay,addDays,statusOf,filterEvents,eventsOnDay,calendarDays,toICS} from '../robotics/model.mjs';
const data=JSON.parse(await readFile(new URL('../robotics/events.json',import.meta.url),'utf8'));
const robot=data.events.find(e=>e.id==='robot-learning-02');
test('Pacific dates do not drift to UTC tomorrow; DST boundary is correct',()=>{
  assert.equal(pacificDay(new Date('2026-11-05T02:00:00Z')),'2026-11-04');
  assert.equal(pacificDay(new Date('2026-11-01T06:59:00Z')),'2026-10-31');
  assert.equal(pacificDay(new Date('2026-11-01T07:01:00Z')),'2026-11-01');
  assert.equal(pacificDay(new Date('2027-03-15T06:30:00Z')),'2027-03-14');
});
test('Upcoming, today, happening now and past follow exact event bounds',()=>{
  assert.equal(statusOf(robot,new Date('2026-11-04T00:00:00Z')),'Tomorrow');
  assert.equal(statusOf(robot,new Date('2026-11-04T20:00:00Z')),'Today');
  assert.equal(statusOf(robot,new Date('2026-11-05T02:00:00Z')),'Happening now');
  assert.equal(statusOf(robot,new Date('2026-11-05T04:30:00Z')),'Past');
});
test('Seven-day range includes ongoing multiday events and excludes day eight',()=>{
 const now=new Date('2026-11-08T18:00:00Z');const events=filterEvents(data.events,{range:'week'},now);
 assert(events.some(e=>e.id==='makermods-hackathon'));assert(events.some(e=>e.id==='x-square-hackathon'));assert(!events.some(e=>e.id==='saratoga-vex-3'));
});
test('Search, region, type and saved filters combine',()=>{
 const e=filterEvents(data.events,{range:'all',query:'robotics',region:'East Bay',type:'Research',savedOnly:true},new Date(),new Set(['ember-mason']));assert.deepEqual(e.map(x=>x.id),['ember-mason']);
 assert.equal(filterEvents(data.events,{range:'all',query:'no-matching-words'}).length,0);
});
test('Calendar spans month/year boundary, leap days and every day of multiday events',()=>{
 assert.equal(calendarDays('2026-11')[0],'2026-11-01');assert.equal(calendarDays('2026-11').length,42);
 assert(calendarDays('2026-12').includes('2027-01-01'));assert.equal(addDays('2028-02-28',1),'2028-02-29');
 assert(eventsOnDay(data.events,'2026-11-08').some(e=>e.id==='makermods-hackathon'));assert(!eventsOnDay(data.events,'2026-11-09').some(e=>e.id==='makermods-hackathon'));
});
test('Unknown times remain tentative date-only entries with exclusive end date',()=>{
 const e=data.events.find(e=>e.id==='humanoids-summit-2026'),ics=toICS([e]);assert(ics.includes('DTSTART;VALUE=DATE:20261201'));assert(ics.includes('DTEND;VALUE=DATE:20261203'));assert(ics.includes('STATUS:TENTATIVE'));assert(ics.includes('(time to confirm)'));
});
test('Timed ICS entries are UTC, stable and escaped; cancellations survive export',()=>{
 const ics=toICS([{...robot,title:'Robot, test; \\ demo\nNew line',status:'cancelled'}]);assert(ics.includes('DTSTART:20261105T010000Z'));assert(ics.includes('DTEND:20261105T043000Z'));assert(ics.includes('STATUS:CANCELLED'));assert(ics.includes('SUMMARY:Robot\\, test\\; \\\\ demo\\nNew line'));assert.equal(ics,toICS([{...robot,title:'Robot, test; \\ demo\nNew line',status:'cancelled'}]));
});
