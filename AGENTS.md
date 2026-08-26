# AGENTS.md — mndatacenter.org: Repository Architecture & AI Behavior Rules

This repository hosts a map-first civic transparency platform documenting data center
infrastructure in Minnesota, built with Astro, MapLibre GL JS, and custom spatial ETL
layers. These rules govern all code generation, refactoring, and data ingestion.

The subject of this site is **industrial infrastructure and the public decisions that
site it**: facilities, permits, utility agreements, tax certifications, water
appropriations, and the governmental units that approve them.

---

## Part 0: Guiding Principles

These are load-bearing. When a design decision is ambiguous, resolve it toward these.

**0.1 — Connection is the product.** Nothing here is an isolated incident. A data center
is a utility agreement is a county board vote is a tax exemption is a transmission line.
A map of unrelated pins fails the mission even if every pin is accurate. The registry
must model **relations as first-class objects**, not just point layers: `facility →
utility → ESA docket → approving body → officials of record`. Every detail panel answers
"what is this connected to?" before it answers "what is this?"

**0.2 — Receipts, not rhetoric.** The antidote to being told you didn't see what you saw
is a document with a number on it. Every published claim resolves to a citable primary
record. The About page can be as angry as it wants; the data layers stay literal,
sourced, and boring. Polemic that outruns its citations is the one thing that gets the
whole project dismissed.

**0.3 — The metaphors do not become code.** "Web of power" is framing for readers, not an
inference engine. Never generate an edge, score, or relationship that isn't in a
document. If two things are connected only by suspicion, they are not connected in the
graph. Suspicion belongs in prose, clearly marked as the author's argument.

**0.4 — Make the routine visible.** These systems advance through consent agendas,
unanimous voice votes, and 4-page staff reports nobody reads. Design bias runs toward
surfacing the boring and unopposed: flag approvals that passed with no discussion, no
public comment, or on consent. What slipped through quietly is the story.

**0.5 — Show the water heating.** Point-in-time snapshots hide gradual change. Every
ingest is versioned and diffed; layers expose a time axis and cumulative counters
(MW approved, gallons/day appropriated, acres permitted, subsidy dollars committed,
year over year). A change feed is a core feature, not an add-on.

**0.6 — Every record ends in an action.** A user who finds something must immediately see
what can be done: which body decides next, when the comment period closes, where to file,
which office to contact, how to export and share the record. Transparency that terminates
in despair is a failure state.

**0.7 — Build for the people it's about.** Prioritize the communities carrying the
externalities. That means: fast on old phones and bad connections, fully usable by
screen reader, no login, no paywall, no tracking, plain-language summaries alongside
every technical field, and bulk export under a permissive license so anyone can take the
data and go.

**0.8 — Outlive the author.** Assume no maintainer. Static output, no vendor lock-in, no
API keys, reproducible builds, mirrored and hashed source documents, dependency-free
ETL, and a `RUNBOOK.md` that lets a stranger rebuild everything from scratch. Every
technical choice is evaluated on whether it still works in ten years with nobody
watching.

**0.9 — Translate the jargon.** ESA, EAW, AUAR, CON, MPARS, 287(g) — every acronym and
term of art gets a glossary entry, and the UI renders the plain-language gloss inline.
Institutional language is a wall; the site's job is a door.

---

## Part 1: Project Architecture & Ethical Guardrails

### 1. The Core Policy: Privacy & Compliance

**Transparency for power; privacy for people.** Scrutiny scales with authority. The line
is not "individuals vs. institutions" — it is **whether the person is exercising public
power or spending public money.**

**1a. In scope, named, in their official capacity:**

* Elected officials at every level — legislators, county commissioners, city
  councilmembers, mayors, sheriffs, county attorneys, appointed regulators and
  commissioners.
* Senior appointed decision-makers: agency commissioners and deputies, city and county
  administrators, planning directors, utility executives, board members of public and
  quasi-public bodies.
* Registered lobbyists and their principals.
* Corporate officers named in filings, in their corporate role.

For these people the site may publish, sourced: votes and vote dates, bill sponsorships
and authorship, motions and seconds, meeting attendance and recusals, public statements
made in official settings, campaign finance receipts (MN Campaign Finance Board),
Statements of Economic Interest, lobbying disclosures, official contact information as
published by their own body, and the decisions their offices issued.

**1b. Out of scope, always, for everyone including the above:**

* Home address, personal phone, personal email, vehicle, daily movements, or any
  real-time location.
* Family members, spouses, children. Never named, never mapped, never counted.
* Health, religion, sexual orientation, immigration status, private conduct, or anything
  unrelated to the exercise of the office.
* Non-supervisory public employees — clerks, inspectors, permit techs, line staff,
  patrol officers. They implement; they do not decide. Record the office, not the person.
* Private residents who commented, petitioned, testified, or were affected. Aggregate
  counts only, never enumerated.
* Photographs other than the official portrait published by the office itself.

**1c. Assertion discipline (this is the rule that keeps the site standing).**

Record the vote. Record the contribution. Record the date of each. Place them adjacent
and let the reader do the arithmetic. **Do not compute, publish, or imply a causal
claim.** No corruption scores, no "bought by" labels, no derived
influence rankings, no auto-generated accusations. Two documented facts side by side are
devastating and unfalsifiable; one inferred motive is a defamation exposure and hands the
other side a way to make the story about you instead of them.

Where the author wants to argue a connection, that argument goes in clearly-bylined prose
marked as opinion, physically separate from the data layer, and cites the same documents.

**1d. Structural enforcement:**

* `src/layers/types.ts` carries a `PersonRole` discriminated union — `elected`,
  `appointed_senior`, `lobbyist`, `corporate_officer`. There is no `private_individual`
  variant, by construction. If an upstream source mixes private individuals into
  systemic data, ingest the systemic attributes and drop the rest.
* Every person record requires `officeHeld`, `jurisdiction`, `termDates`, and a
  `sourceUrl` for each attributed act. A person with no attributed official act does not
  get a record.
* Officials leave the active layer when they leave office, but their acts remain in the
  historical record, dated and attributed to the office they held.
* When in doubt, leave it out.

* **Structural Enforcement:** `src/layers/types.ts` must never carry a natural person's
  name or an individual identifier. If an upstream source mixes individual records into
  systemic data, ingest the systemic attributes and drop the rest. When in doubt, leave
  it out.

* **Parcel Data Is A Landmine:** MetroGIS and county parcel datasets contain
  **individual homeowner names** in the owner field. Ingest scripts touching parcel data
  MUST filter to non-natural-person owners (corporate suffixes, LLC, LP, Inc., Trust
  where corporate, government units) and null the owner field otherwise. Never publish a
  parcel row whose owner cannot be positively classified as an entity. Adjacent
  residential parcels may be counted in aggregate ("N parcels within 1km") but never
  enumerated with owner detail.

* **People In Public Documents:** EAWs, PUC dockets, and council minutes name decision-
  makers, project managers, consultants, commenting residents, and petition signatories.
  Ingest per §1a/§1b: the officials who voted are named; the residents who commented are
  counted. A comment count is systemic; a commenter list is not. Never build a layer,
  filter, or search index over the names of private citizens who spoke at a public
  meeting — including supportive ones.

* **Public Offices Only:** `src/lib/authority.mjs` returns offices, never individuals.
  Every office named must be the statutory default in Minn. Stat. § 13.02, subd. 16(b),
  cited in place. Cite the statute next to any new office added.

* **Corporate Entities Are Not People:** Named operators, parent companies, shell LLCs,
  and their registered agents (when the agent is a corporate service company) are in
  scope and should be named plainly. An individual listed as a registered agent or
  organizer in Secretary of State filings is not — record the entity, drop the human.

### 2. Source Tiering — The Governing Rule Of This Repository

Every published row must resolve to a **Tier 1 or Tier 2** document. Lower tiers may
generate leads and may inform `confidence`, but may never be the sole basis for a
published feature.

**Tier 1 — Minnesota state records (primary; strongest).**

| Source | What it yields | Notes |
|---|---|---|
| DEED certified "qualified data center" roster (Minn. Stat. § 297A.68 subd. 42) | Authoritative list of certified large commercial facilities | Not published live. Obtained via MGDPA Ch. 13 request; store the response document and request date in `provenance` |
| PUC eDockets — ESAs and very-large-customer tariffs | Named projects, MW figures, siting, timelines *before construction* | Tariff docket M-25-289; individual ESA dockets. Expect trade-secret redactions — record what was withheld |
| EQB Monitor + EAW/EIS documents | Best geospatial source: address, parcel, acreage, MW, water consumption, generator counts, in a standardized worksheet | Fixed publication schedule; suitable for the scheduled fetcher |
| MPCA air permits / What's in My Neighborhood | Coordinates, facility IDs, generator count, fuel throughput | Backup generation requires permits; throughput is a size proxy, label it as such |
| DNR MPARS water appropriation permits | Cooling withdrawals with **reported actual** annual volumes | Reported actuals, not estimates. Prefer over any projected figure |
| MN Geospatial Commons / MetroGIS parcels | Ownership entity, assessed value; address join to resolve LLCs | Subject to the parcel-privacy rule in §1 |
| Legislature — roll calls, bill authorship, committee records (Revisor / House & Senate journals) | Named votes with dates, tied to the officials layer | Roll calls only; voice votes recorded as "no recorded vote," which is itself a finding |
| County & municipal minutes, agendas, consent agendas | Local approvals, conditional use permits, TIF and abatement votes | Feeds §0.4 — flag consent-agenda and no-discussion passage |
| MN Campaign Finance Board — receipts, Statements of Economic Interest, lobbyist disclosures | Contributions, sources of income, registered lobbying by principal | Adjacent to votes per §1c. Facts only, never a derived score |

**Tier 2 — Federal records (primary).** FERC eLibrary; MISO generator and load
interconnection queues (early signal, often years ahead of permits); EIA Forms 861/923
for utility-level load; EPA FRS/ECHO for facility IDs and emissions; SEC filings
(10-Ks from Digital Realty, Equinix, Iron Mountain and peers enumerate facilities and
square footage — first-party and legally binding).

**Tier 3 — Operator-submitted, non-governmental.** PeeringDB (operator-submitted
facility records with street addresses; catches colo and carrier-hotel sites that never
trigger state thresholds); cloud provider region/AZ documentation (first-party but
deliberately vague on siting). Usable as corroboration and for facilities with no Tier
1/2 footprint, but must be flagged `tier: 3` in the UI.

**Tier 4 — Aggregators. Lead lists only.** MTJP tracker exports, poweredbywho,
cleanview, FracTracker. These may seed a research queue in `scripts/leads/`. They must
**never** appear as the `primarySource` of a published feature. An unresolved Tier 4
lead is a `knownGaps` entry, not a map pin.

### 3. Entity Resolution — Shell LLCs

Hyperscaler projects are filed under single-purpose subsidiaries. Name-matching on
operator will silently miss the largest facilities in the state.

* The schema separates `filingEntity` (the LLC exactly as it appears on the document)
  from `beneficialOperator` (the parent, where established).
* `beneficialOperator` may only be populated from a **citable** link: a PUC filing that
  states the relationship, an SEC filing, a Secretary of State record, or a company press
  release. Set `beneficialOperatorSource` alongside it.
* Never infer a parent from journalism alone, from name similarity, or from vibes. If
  the link is reported but not documented, leave `beneficialOperator` null and record the
  reporting in `notes` with `confidence: "reported"`.

### 4. Data Provenance & Citation Rules

* **Provenance Record (required on every feature):**
  `primarySourceUrl`, `documentType`, `documentId` (docket number, permit number, EAW
  file number), `issuedDate`, `retrievedAt`, `tier`, `confidence`.
* `confidence` is an enum: `confirmed` (Tier 1/2 document names the facility directly),
  `corroborated` (two independent lower-tier sources agree), `reported` (credible
  secondary reporting, not yet documented), `lead` (unresolved — not rendered).
* **Document Retention:** Ingest scripts snapshot the source document (PDF/XLSX) hash
  and, where licensing permits, mirror it under `public/data/docs/`. A citation that
  404s in eighteen months is not a citation. Record the hash regardless.
* **Missing Sources:** Never fabricate or infer data. If an upstream field, primary
  source, or link does not exist, leave the field `null`, explicitly state
  `"No source found"` in the documentation/UI link field, and detail the gap in
  `knownGaps`.
* **Redaction Is Data:** When a PUC filing withholds load estimates or cost figures as
  trade secret, record `redacted: true` with the claimed basis. The fact that a figure
  was withheld is itself publishable and is often the most useful thing on the page.
* **Upstream licenses** must be checked against `LICENSE-DATA.md` and recorded with
  attribution text.

### 5. Coverage Honesty

No single source covers all facilities. Municipal utilities and cooperatives fall
outside PUC jurisdiction; sub-threshold facilities never trigger environmental review;
DEED certification only captures facilities pursuing the tax exemption.

* `src/layers/registry.ts` entries carry a `coverage` field describing what the layer
  structurally cannot see.
* The site must render a persistent, plain-language **"What this map can't see"**
  section derived from those fields. This is a build-time requirement, not a nice-to-
  have — claiming completeness we cannot back is the fastest way to lose the argument.

### 6. Architecture & Layer Ingestion

The layer registry is the single source of truth. `src/layers/registry.ts` drives the
map, legend, filters, detail panels, sources page, downloads, and "near me" view.

* **Two-File Additions:** Adding a layer requires **exactly two files**:
  1. An ingest script in `scripts/ingest/` that emits the shared schema to `public/data/`.
  2. One entry in `src/layers/registry.ts`.
  * *Do NOT edit UI components directly to add layers.*
* **Dependency-Free ETL:** `scripts/ingest/` scripts run on Node and must remain
  dependency-free (`lib/util.mjs` handles ZIP/XLSX/PDF-text decoding). `counties.mjs`
  must run before other layers.
* **Shared Libraries:** `src/lib/geo.mjs` and `src/lib/authority.mjs` are shared between
  ingest scripts and the browser to prevent drift between build-time assignment and
  in-browser execution.
* **Build Readers:** `src/layers/data.ts` reads static outputs directly at build time so
  UI counts and dates never drift from generated JSON.
* **Good-Citizen Fetcher:** Scheduled fetchers (EQB Monitor, eDockets, MPCA) identify
  themselves with a descriptive User-Agent and contact address, respect robots.txt and
  rate limits, and back off on error. No ToS-questionable techniques: no internal/private
  API scraping, no residential-proxy block evasion, no credentialed-portal automation.
  If a source cannot be fetched politely, it gets a `knownGaps` entry and a manual
  workflow, not a workaround.

### 7. Client Constraints & Accessibility

* **Zero Third-Party Assets:** No external analytics, external fonts, remote embeds, or
  cloud geocoding APIs. All spatial operations (including "near me") run locally
  on-device against static indexes.
* **Accessibility Sync:** The DOM record list beside the MapLibre canvas is the primary
  screen-reader interface and must stay perfectly in sync with drawn features. Respect
  `prefers-reduced-motion` and label all controls.
* **Units:** Power in MW, water in gallons/day and acre-feet/year, area in both acres and
  m². Always render the unit; never a bare number.

---

## Part 2: Commands & Workflow

```bash
npm install
npm run data      # Rebuild all layers from upstream (network required, no keys)
npm run leads     # Refresh Tier 4 lead queue; does NOT touch published layers
npm run dev       # Start Astro dev server
npm run check     # Run astro check & type verification — MUST STAY AT 0 ERRORS
npm run build     # Production build
```