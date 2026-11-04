# Bay Area Robotics

Live route: https://ricburton.com/robotics/

A buildless page on the existing GitHub Pages site (`main`, repository root). The rest of the site is unchanged except for a link in the homepage's social navigation.

## Source of truth

`events.json` drives the chronological list, the interactive calendar, and `events.ics`. All event dates use `America/Los_Angeles`. Timed records carry explicit offsets; date-only records intentionally have no fabricated clock times. The ICS generator exports unknown times as tentative, all-day placeholders with an exclusive end date. Multi-day timed exports span the event's first opening through final closing; daily schedules remain in their descriptions. Saved events use this browser's local storage and are not registrations.

The November 3, 2026 review includes public organizer pages in San Francisco, the Peninsula, South Bay, and East Bay, primarily November–December plus announced conferences in 2027. It is not exhaustive, and no North Bay occurrence was verified in this pass. Restricted university events and youth/team competitions are explicitly labeled. Generic AI events without a clear robotics component, past events, and unconfirmed recurring meetup instances are excluded.

Every record includes its organizer source URL and verification date. Additional sources document date conflicts. Luma's public JSON-LD supplies explicit event timestamps where the rendered text omits its header date; detailed organizer agendas take precedence when metadata and prose disagree, or the conflict remains visible. No inferred secret/private venue addresses are used.

## Refresh and publish

This is a **manual editorial refresh**, not automated event discovery. The reload button retrieves the most recently published JSON with `cache: no-store`; it does not re-verify the source pages. Browser return-to-tab also reloads the published data. Time-sensitive badges update once a minute while visible. Calendar apps control when they refresh subscriptions. A visible warning appears when the overall source review is older than seven days; old individual reviews are labeled on their cards.

1. Reopen the first-party links in `events.json`. Check dates, Pacific times, city, venue, cost, registration status, restrictions, and any unresolved differences.
2. Search organizer calendars for newly announced events: [Silicon Valley Robotics](https://www.svrobo.org/robotics-events/), [BARA](https://luma.com/BARA), [Saturday Robotics](https://luma.com/junfanzhu), [EMBER](https://ember-lab.eecs.berkeley.edu/seminars/), [Stanford Robotics](https://src.stanford.edu/src-events), [Open Robotics](https://discourse.openrobotics.org/), [VEX](https://events.vex.com/), and [Robot Combat Events](https://www.robotcombatevents.com/). Do not turn a general recurrence into a dated event without verification.
3. Edit `events.json`. Keep IDs stable for saved events and calendar subscriptions. Increment only the records' `verified` dates actually checked. Change `lastReviewed` only after reviewing coverage as a whole. Preserve uncertainties in `notes`. Retain cancelled records with `status: "cancelled"` so subscribed calendars receive cancellation updates. Old records remain available under All dates; do not silently delete upcoming subscribed events.
4. Run from the repository root:

   ```sh
   node scripts/robotics-check.mjs --write
   node scripts/robotics-check.mjs
   node --test scripts/robotics-model.test.mjs
   node --check robotics/app.js
   ```

5. Serve the repository locally (`python3 -m http.server 8765 --bind 127.0.0.1`) and check the list/calendar, search, filters, saved events, and narrow screens. Stop the server afterwards.
6. Commit only the intended files and push to `main`. The existing GitHub Pages deployment publishes them; no new hosting account or build system is needed. Confirm the Pages build succeeded and the live JSON, page, and ICS match the commit.

Do not treat a successful HTTP response or CI validation as renewed factual verification. Dates should advance only after an editorial review.

## Checks

`robotics-check.mjs` validates required metadata, dates, unique IDs, duplicate titles/dates, HTTPS links, allowed regions/formats, timed Pacific dates, and generated calendar parity. It performs no network calls. Tests cover the UTC/Pacific boundary, daylight saving, exact start/end states, ongoing multi-day events, filtering, calendar month/year boundaries, leap days, ICS escaping, unknown times, and cancellations. A scoped GitHub Actions workflow runs these checks on future changes.

## Source conflicts retained

- X Square: the agenda ends awards at 6pm; metadata ends at 8pm. Display the known start and flag the finish. Nov 13 opening is described as a separate registration in the main listing.
- Physical AI Conference: advertised standard ticket differs from the minimum price in structured data. Display the advertised $40 standard and ask visitors to confirm their ticket category.
- VEX middle school: capacity-reached message conflicts with a remaining-spots counter; do not advertise availability.
- Berkeley Bot Bash: body and metadata disagree on venue and overall hours. No fixed venue/time is promised.
- IEEE Humanoids: public programming begins Dec 6, while the IEEE main conference listing begins Dec 7.
- GTC: main page says Mar 15–18, FAQ says Mar 14–18. Main dates are shown with the discrepancy visible.
