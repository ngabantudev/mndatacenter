# Spec: Facility Pins — Legacy Industrial Sites as a Toggleable Map Layer

Status: draft, not yet built. Written before any code changes, per the
project's own precedent (see `pollution-scale-comparison-spec.md`). Contains
one direct reversal of a decision in that document — see §2.1 — flagged for
review, not snuck past it.

---

## 1. Goal

`mnPollutionScale.ts` currently holds ~20 legacy industrial sites (taconite
mines, coal plants, refineries, pulp mills, sugar mills) with real,
per-facility pollution data — tonnage, a regional-haze visibility ranking,
water appropriation — but none of it is on the map. It only surfaces inside a
side-panel comparison dialog.

This feature puts those facilities on the map as their own toggleable pin
layer, nested under the existing "Climate & Regional Impacts" section, off by
default, so a reader can see *where* Minnesota's largest documented pollution
sources actually sit — relative to data center sites, relative to Class I
protected areas, relative to their own town — not just their rank in a list.

**What changes for whom:** a reader who has just read "no data center appears
on this list" in the comparison panel can now turn on a layer and see the ~20
facilities that do, sited on the same map, without leaving the page.

---

## 2. Resolved decisions

### 2.1 Reversing the prior "no map pins" decision — on purpose, not by accident

`pollution-scale-comparison-spec.md` §2.1 decided against any map pin for
this data, for three real reasons. This spec has to answer all three, not
route around them:

1. **"A pin on Minntac says Minntac is in [the map's declared] set."** The map's
   subject is data center infrastructure and the public decisions that site
   it. **Resolution: this layer does not use the `Project` type, does not
   appear in `dataCenters.ts`, is not filterable by `FilterProject` /
   `FilterSize` / `FilterStatus`, and does not appear in the accessible DOM
   record list that enumerates data center sites (CLAUDE.md §7).** It is a
   structurally separate marker set with its own accessible list, off by
   default, under a section already named "Climate & Regional Impacts" —
   context that announces its subject is the regional backdrop, not a peer
   project.
2. **"Geography carries no information here... a map of unrelated pins."**
   That was true for a *comparison of magnitude* (11M tons vs. no figure) —
   it is not true for *siting*. Where Minntac's tailings basin sits relative
   to the St. Louis River, or where Sherco sits relative to the Amazon
   generator proposal in the same city (§7 of the prior spec flagged this
   exact coincidence and deferred it here), is genuine geographic
   information this feature is built to surface. The prior spec's own §7
   open question 5 anticipates this.
3. **"The existing overlay registry cannot hold it."** Still true — `mapLayers.ts`
   is polygon/PMTiles only. This layer does not go there. It follows the
   `moratoriums.ts` + `moratoriumLayer.ts` precedent instead: a hand-sourced
   registry compiled into the bundle, rendered by its own small module, toggled
   from a slot inside an existing `FilterLayer.astro` accordion group — the
   exact mechanism `FilterMoratorium.astro` already uses for the Politics
   section. No `MAP_LAYER_META` entry, no PMTiles archive, no ingest pipeline.

**One more precedent this spec leans on directly:** `moratoriumLayer.ts`
*used to* draw a dot per city and the dot was removed — "it made a location
claim we could not support," because a city-centre point is not city hall and
not a project site. That is the exact failure mode this feature has to not
repeat. It doesn't: every coordinate here resolves to EPA's Facility Registry
Service record for the specific site (see §2.3), not an inferred or
approximated point.

### 2.2 Facility identity: a new canonical list, existing metric arrays untouched

**Decision: add `src/data/mnPollutionFacilities.ts`, a small canonical list —
`{ facilityId, name, county, sector, coordinates, frsSource }` — one row per
physical site. `GHG_ROWS`, `TRI_TOP_FACILITIES`, and `WATER_ROWS` in
`mnPollutionScale.ts` each gain an optional `facilityId` field pointing at
this list. Nothing about how those arrays are sourced, reviewed, or typed
today changes.**

This was the explicit choice over restructuring into one master record,
because those three arrays are independently sourced (GHG from Star Tribune/
GHGRP, TRI/visibility from the Region 5 Q/D docket, water from DNR/MPCA) and
already reviewed — collapsing them risks re-introducing exactly the kind of
transcription error caught and fixed earlier in this same branch. A
`facilityId` join key lets the map ask "every metric this project has for
Minntac" without touching how any one metric is sourced or verified.

Same-site name variance is real and has to be resolved once, here, not
silently: `"US Steel Corp – Minntac"` (TRI list) and `"Minntac"` (water row)
and any future GHG-row entry for the same site all point at one
`facilityId: 'minntac'`. The canonical list's `name` becomes the pin's
display name; per-metric arrays keep their own `facility` string as-is (it's
already reviewed prose, some of it inside quoted source language) and the
join is by id, not by re-matching strings at render time.

**Facilities with no metric row yet still get a canonical entry if they're in
the Class I visibility list** — the pin layer's job is "where are Minnesota's
documented pollution sources," and a facility can be genuinely on that list
via one metric only (e.g. American Crystal Sugar, water/GHG rows: none yet)
without that being an error to fix here.

### 2.3 Coordinates: EPA FRS, fetched once, reviewed, committed as literal data

**Decision: a one-off Node script, `scripts/lookup-facility-coordinates.mjs`,
queries EPA's Facility Registry Service (`ofmpub.epa.gov/frs_public2/...` or
the Envirofacts REST endpoint already proven reachable this session —
`data.epa.gov/efservice/...`) by facility name/state, and prints a
reviewable table (name, matched FRS registry id, lat/lon, EPA's own facility
name for the match). A human confirms each match against the facility's
known county/city before it's hand-copied into
`mnPollutionFacilities.ts` with the FRS Registry ID and retrieval date cited
per row — the same citation discipline `dataCenters.ts` already uses for its
hand-entered coordinates.**

This is not a maintained ingest pipeline (the repo has none, per CLAUDE.md
§6's aspirational-vs-actual gap, already flagged in the prior spec's open
question 1) — it's a one-time lookup tool, kept in `scripts/` so a future
contributor adding a 21st facility can re-run it instead of hand-geocoding.
It is explicitly **not** a runtime dependency: nothing at build time or in
the browser calls EPA FRS. This satisfies CLAUDE.md §7's "no cloud geocoding
APIs" — that rule is about the live site never depending on an external
geocoder, not about how a one-time data-entry pass sources a citation.

Match confidence matters: FRS name matching is fuzzy (company name variants,
multiple registered units per site). Every matched coordinate needs its FRS
Registry ID recorded specifically so a reader — or a future contributor —
can verify it independently, the same way this session verified the two
`triId` values against Envirofacts rather than trusting a plausible-looking
string.

### 2.4 Rendering: a new small marker module, not the `Project` marker system

**Decision: a new `src/lib/facilityMarkers.ts` + its own GeoJSON source/layer
pair in `MapParent.astro`, structurally parallel to the existing
`MARKER_SOURCE_ID` project-marker system but not sharing its code.**

The existing project markers scale circle radius by `sqrt(MW)` and color by
`ProjectStatus` — both meaningless for a coal plant or a taconite mine. A
facility pin instead:

- Sizes by `cumulativeQD` where available (the regional-haze screening score
  already computed and sourced — see §2.5 on why *not* to size by tonnage),
  falling back to a fixed size for facilities with no Q/D entry (e.g. a
  water-only or GHG-only row).
- Colors by `sector` (taconite, coal, refining, pulp/paper, sugar) via a
  small fixed palette — legend-worthy, unlike `ProjectStatus`'s meaning,
  which doesn't apply here.
- Detail panel lists **every metric this project has for the site** — GHG
  (if present), visibility rank + tonnage (if present), water appropriation
  (if present) — each with its own tier/confidence badge and source link,
  matching the badge treatment already built for `PollutionScaleTracker.astro`.
  A facility present in only one metric array shows only that section, plus
  a line naming which other metrics were checked and came back
  `no_record_found` or were never searched — never a silent blank.

### 2.5 What sizes the pin, and the one thing that must not

**Decision: size by `cumulativeQD`, never by raw tonnage summed across
pollutants, and never a computed "total pollution" figure.**

Summing tons of ammonia + CO2 + NOx + PM10 + PM2.5 + SO2 into one number
would be exactly the kind of derived figure CLAUDE.md §0.3 and the prior
spec's derived-figure prohibition (§2 of that doc) forbid — different
pollutants at wildly different toxicity and different units of harm, added
together, would imply a "total pollution score" this project's own sourcing
rules do not support computing. `cumulativeQD` is safe to size by because
it's not computed here — it's the ranking already published, verbatim, in
the source document.

### 2.6 The toggle UI: a "Facilities" row inside the existing Climate group, expanding to sector checkboxes

**Decision: a new `FilterFacilities.astro`, rendered into `FilterLayer.astro`'s
existing `<slot />` for `group="climate"` — the same slot mechanism
`FilterMoratorium.astro` already uses for the Politics group. One master
checkbox ("Facilities" / pollution sources, off by default) plus, revealed
once checked, one checkbox per sector** (taconite mining/processing, coal
power generation, pulp/paper, petroleum refining, sugar mills) **— this is
the "dropdown with further options" from the request.**

This is genuinely new UI: nothing in the codebase today nests a second level
of checkboxes inside one accordion row. It follows the same visual and event
pattern as the existing flat checkboxes (`environmental-layer-toggle` class,
`mapfilterchange` custom event) rather than inventing a second toggle
mechanism — the only new part is that checking the master row reveals a
sub-list, and each sub-checkbox filters the already-rendered marker source
by `sector` rather than adding/removing a map source.

---

## 3. In scope for v1

1. `src/data/mnPollutionFacilities.ts` — canonical facility list: id, name,
   county, sector, coordinates, FRS citation, per row.
2. `scripts/lookup-facility-coordinates.mjs` — one-off FRS lookup tool.
3. `facilityId` added (optional) to rows in `GHG_ROWS`, `TRI_TOP_FACILITIES`,
   `WATER_ROWS` — no other change to those arrays.
4. `src/lib/facilityMarkers.ts` + GeoJSON source/layer pair in
   `MapParent.astro`, sized by `cumulativeQD`, colored by `sector`.
5. Detail panel per facility, aggregating every sourced metric for that
   `facilityId`, badge-per-metric, matching `PollutionScaleTracker.astro`'s
   confidence/tier treatment.
6. `FilterFacilities.astro` — master toggle + sector sub-toggles, rendered
   into the existing Climate group's slot.
7. Accessible DOM record list for this layer, separate from the data-center
   one, kept in sync per CLAUDE.md §7.
8. Legend entry (sector color key) shown only while the layer is on.

### Explicitly out of scope for v1

- Any change to `Project`, `dataCenters.ts`, `FilterProject`, `FilterSize`,
  `FilterStatus`, or the existing accessible record list. This layer is
  additive and structurally separate, per §2.1.
- Any composite "total pollution" figure, per §2.5.
- Sizing or coloring by tonnage directly (reserved for a future pass once
  more facilities have complete tonnage data — right now several rows are
  `null` on `ammonia`/other fields, and a marker literally missing on the
  map for a `null` field would misread as "no pollution").
- The Becker co-location note (Sherco / Amazon generator site / Vonco II
  landfill) flagged in the prior spec's open question 5 — real, sourced, and
  now finally has a map to live on, but it's a specific cross-reference
  inside one facility's detail panel, not part of getting the base layer
  shipped. Tracked as a fast v1.1 follow-up.
- Facilities beyond the ~20 already in `mnPollutionScale.ts`. No new
  research to expand the underlying list is in scope here.
- Out-of-state facilities from the same Q/D source document (already
  excluded from `mnPollutionScale.ts` per the prior session's scope
  decision).

---

## 4. Seams touched

| Path | Change |
|---|---|
| `src/data/mnPollutionFacilities.ts` | **new** — canonical facility list |
| `scripts/lookup-facility-coordinates.mjs` | **new** — one-off FRS lookup tool |
| `src/data/mnPollutionScale.ts` | add optional `facilityId` field to 3 row types |
| `src/lib/facilityMarkers.ts` | **new** — marker builder, mirrors `mapMarkers.ts` shape |
| `src/components/map/MapParent.astro` | new GeoJSON source/layer pair, new custom event listener |
| `src/components/filter/FilterFacilities.astro` | **new** — rendered into `FilterLayer.astro`'s climate-group slot |

Deliberately untouched: `mapLayers.ts`, `dataCenters.ts`, `projectFilters.ts`,
`popupHtml.ts`, `MARKER_SOURCE_ID` and its paint/hit-test logic, every
`Project`-typed filter component.

---

## 5. Unhappy paths

| Case | Behavior |
|---|---|
| A facility has no metric rows at all (canonical entry only) | Pin still renders (it's a documented Class I visibility-screening entry); detail panel states plainly that no GHG/water/TRI-adjacent row exists for it yet, rather than omitting sections silently. |
| FRS match is ambiguous or low-confidence for a facility | That facility is left out of `mnPollutionFacilities.ts` entirely rather than guessed — logged as a `KNOWN_GAPS` entry naming the facility and why the match wasn't confirmed. No approximate pin. |
| Sector sub-toggle filters to zero facilities | The sub-list still renders (so a reader can see the category exists and is just empty on today's list), map shows no pins for it. |
| Same physical site named slightly differently across metric arrays | Resolved once via `facilityId`, not per-render string matching — see §2.2. |
| A facility's `cumulativeQD` is absent (metric-only entries with no Q/D rank) | Falls back to a fixed pin size, visually distinguished (e.g. lower opacity) so a reader can tell "no ranking data" from "small ranking." |

---

## 6. Done criteria (observable)

1. "Facilities" appears as a row inside the existing "Climate & Regional
   Impacts" accordion, off by default.
2. Checking it reveals sector sub-checkboxes; unchecking any sub-box removes
   just that sector's pins.
3. Every rendered pin's coordinates trace to a cited FRS Registry ID and
   retrieval date, checkable in `mnPollutionFacilities.ts`.
4. Clicking a pin opens a detail panel listing every sourced metric for that
   facility with its own tier/confidence badge — never a blended or
   composite figure.
5. No pin's size or color is computed from more than one pollutant summed
   together.
6. The data-center accessible record list is byte-for-byte unaffected; a
   second, separate accessible list exists for facility pins.
7. `npm run check` at 0 errors; `npm run build` clean.
8. Turning the layer off removes every facility pin, its legend, and its
   accessible list from the DOM — nothing lingers hidden-but-present.

---

## 7. Open questions — not decided here

1. **Marker visual language.** Should facility pins look deliberately
   *different* in shape from data-center circles (not just a different
   color), so a colorblind reader or a screenshot without the legend still
   reads "this is not a project site" at a glance? Design call.
2. **Does this become the pattern for future non-project layers** (e.g. a
   future utility-infrastructure or transmission-line layer), making
   `facilityMarkers.ts` worth generalizing now rather than later? Deferred —
   build this one concretely first per the project's own stated bias toward
   shipping the specific case before generalizing.
3. **CLAUDE.md's aspirational ingest architecture**, already flagged as
   unresolved in the prior spec's open question 1, is touched again here
   (`scripts/lookup-facility-coordinates.mjs` sits where `scripts/ingest/`
   would live in the target architecture but isn't one). Same maintainer
   decision needed, not made bigger by this feature.
