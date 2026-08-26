# Spec: Scale Context — Minnesota Pollution Sources vs. Documented Data Center Footprint

Status: ready to build. Four open questions flagged at the end; none block v1.

---

## 1. Goal

A hostile reader arrives believing this site overstates its case. The feature exists so that, within thirty seconds, they can see that the site itself says data centers are **not** Minnesota's top polluter on any metric where a verified figure exists — and that legacy industrial sources (taconite, coal, refining) dominate by a documented margin.

The calibration is the point. Conceding the emissions argument on the site's own initiative is what makes the MW argument survive contact with an opponent. Secondary framings — the absence ledger and the one-axis MW argument — live inside this same view as row states, not as separate features.

**What changes for whom:** an organizer, reporter, or hearing-room participant can cite this view to preempt "you're exaggerating," and can point at the two blank rows to say what the state has not yet required anyone to disclose.

---

## 2. Resolved decisions

### 2.1 Not a map layer. A comparison panel.

**Decision: no new map pins, no new PMTiles overlay. This is a `<dialog>` panel following the `CleanGridBar` → `CleanGridTracker` precedent.**

Reasons, in order of weight:

1. **It changes the map's declared subject.** The map is data center infrastructure and the public decisions that site it. A pin on Minntac says Minntac is in that set. Every downstream affordance would then lie: `FilterProject`, `FilterSize`, `FilterStatus`, and `projectFilters.ts` all operate over `Project`, and the accessible DOM record list beside the canvas (CLAUDE.md §7) would enumerate a taconite plant as a peer of a data center.
2. **Geography carries no information here.** The comparison is one of magnitude. That Minntac is in Mt. Iron and Sherco is in Becker adds nothing to "11M tons vs. no reportable figure." A map of unrelated pins is the failure mode CLAUDE.md §0.1 names explicitly.
3. **The existing overlay registry cannot hold it.** `MAP_LAYER_META` in `src/data/mapLayers.ts` is polygon-fill-only — `fileName`, `hex`, `fillOpacity`, `outlineHex`. Point features would be a new rendering path, not a registry entry, so the "two-file addition" rule doesn't apply and adding a layer entry would be a lie about what the entry does.
4. **One coincidence is worth noting and not building on:** Sherco sits in Becker, as does the Amazon site proposing 250 diesel generators on the former coal plant's ground, as does the Vonco II landfill (#28 on the GHG list). That is a genuinely strong fact. It belongs as a **sourced note on the Becker data center's existing detail panel**, not as a second pin. Deferred to v2 — see §7.

**Entry point:** a compact trigger in the same top-centre stack as `CleanGridBar`, or a rail row. It must not be a third banner competing with `CleanGridBar` and `CampaignBanner` for the same strip — resolve placement against those two before building. The dialog itself follows `CleanGridTracker.astro`'s pattern exactly: native `<dialog>`, `showModal()` called only by the dialog's own script, click-outside-to-close, `dvh`-capped height with internal scroll, explicit `display:none` when not `[open]` because Tailwind Preflight otherwise leaves it on screen.

### 2.2 Confidence gate: ship the structure, withhold the unverified numbers

**Decision: v1 renders every metric row, but no row renders a numeric magnitude whose value is only `reported`.** The row still appears, named, with the exact primary document that needs pulling.

This threads CLAUDE.md §2 (published rows resolve to Tier 1/2 documents) and §4 (`reported` is a real confidence state, and only `lead` is explicitly "not rendered") by splitting one field into two:

- **`entityConfidence`** — how well-established is it that this facility belongs on this list at all.
- **`valueConfidence`** — how well-established is the number.

Sherburne County Generating Station is `entityConfidence: corroborated` (it appears in an EPA rulemaking docket attachment's TRI-derived ranking) and `valueConfidence: reported` (~11M tons CO2e comes from Star Tribune citing GHGRP, and the research doc says the primary GHGRP record could not be opened). So v1 renders **Sherco, named, ranked #1, with no tonnage figure** and a line saying the figure is pending a direct pull from EPA FLIGHT.

This is uncomfortable and it is correct. The ~11M tons figure is simultaneously the most rhetorically useful number in the research doc and its weakest-sourced. A credibility-armor feature that gets its headline number wrong destroys the thing it was built to protect.

**What clears the gate for v1 (publishable now):**

| Row | What ships | Anchor source | Confidence |
|---|---|---|---|
| Statewide electricity-sector CO2 | 20,842 thousand metric tons; 57,276,862 MWh; ~801 lbs CO2/MWh; MN ranked 29th (2023) | EIA Minnesota Electricity Profile 2023 | Tier 2, `confirmed` |
| TRI — top MN facilities | The **ordered list of 11 named facilities and sectors**, no pound figures | EPA rulemaking docket `EPA-R05-OAR-2024-0216-0045` attachment 1 | Tier 2, `corroborated` (order only) |
| Statewide TRI total | 592 facilities / 113.1M lbs — **held back**, aggregator-sourced | — | `reported` → withheld |
| Data center air — Becker | PUC denied Amazon's Certificate-of-Need exemption 2025-03-01 for a proposed 250-generator / ~600 MW standby fleet | PUC order (via Data Center Frontier) | Tier 1, `confirmed` as a decision |
| Data center water | **No record found** in DNR MPARS for any named MN data center | DNR MPARS | finding, see §2.4 |
| Data center air permit | **No issued** MPCA air permit found for any named MN data center; MPCA states its data center touchpoint is backup diesel fleets | MPCA `pca.state.mn.us/data-centers` | Tier 1, `confirmed` for the regulatory statement; absence for the permit |
| Data center MW (ESA) | Hermantown 700 MW and Pine Island 1,900–2,700 MW render as **pending** — both `reported`, both with unconfirmed docket numbers | — | see below |

**What is explicitly withheld from v1 pending a primary re-pull:** every per-facility TRI pound figure; Sherco / Boswell / Pine Bend CO2e tonnages; the 113.1M lb statewide TRI aggregate; Minntac's ~7.2 MGD (also the wrong instrument — a DEIS discharge figure, not an MPARS appropriation); Hermantown's 700 MW and Pine Island's 1,900–2,700 MW; the Oppidan halted-project figures; the Pine Island square footage and acreage.

The MW row is the painful one, because MW is the axis where the honest answer is "data centers are large." Shipping the row as `pending` and naming the two dockets to pull is still better than shipping a number sourced to a utility press release restated by a trade outlet. **The re-pull backlog in §6 is therefore a v1.1 deliverable, not a nice-to-have** — the MW row is the argument, and it stays greyed until someone pulls the ESA filings from eDockets.

### 2.3 Architecture: extend `src/data/*.ts`, do not start `scripts/ingest/`

**Decision: one new hand-curated module, `src/data/mnPollutionScale.ts`, plus one new component pair. No ingest script, no `public/data/` output, no `src/layers/registry.ts`.**

Reasons:

1. **The precedent is exact.** `mnCleanGridStandard.ts` opens with a memo that every value is a citable claim, not derived math, with a source and vintage on the line below it. Same class of dataset as this one.
2. **The dataset is ~15 rows that change annually at most.** TRI and GHGRP publish yearly. An ETL pipeline for fifteen slow rows is machinery without a load.
3. **The sources resist polite automation.** TRI Explorer and MPARS both require per-facility ID queries with no bulk endpoint; the research doc records TRI Explorer's state factsheet URL 404ing and multiple MPCA/EPA PDFs returning as non-extractable binary. CLAUDE.md §6 says a source that cannot be fetched politely "gets a `knownGaps` entry and a manual workflow, not a workaround." The manual workflow is this file.
4. **CLAUDE.md's two-file rule is scoped to map layers.** This is not a map layer, by §2.1.

**This diverges from CLAUDE.md §6 as written, and that divergence is real and should be reconciled in the doc rather than quietly tolerated** — see §7, Open Question 1.

**Module shape** (types only; no implementation here):

```
PollutionMetric   = 'ghg_co2e' | 'tri_releases' | 'water_appropriation'
                  | 'air_permit_generators' | 'electric_capacity_mw'
SubjectClass      = 'legacy_industrial' | 'data_center'
ValueState        = 'published' | 'pending_verification'
                  | 'no_record_found' | 'not_applicable' | 'redacted'
Tier              = 1 | 2 | 3 | 4
Confidence        = 'confirmed' | 'corroborated' | 'reported' | 'lead'
```

Each row carries: `facility`, `sector`, `subjectClass`, `metric`, `valueState`, `value` (nullable), `unit` (**required whenever `value` is non-null** — CLAUDE.md §7, never a bare number), `year`, `tier`, `entityConfidence`, `valueConfidence`, `primarySourceUrl`, `documentType`, `documentId` (nullable), `retrievedAt`, `plainLanguage`, and — where `valueState` is not `published` — `pendingSource` naming the exact document and lookup key required.

Enforce by construction: `value !== null` requires `valueState === 'published'` **and** `valueConfidence` in `{confirmed, corroborated}`. A discriminated union on `valueState` makes this a type error rather than a review comment. `confidence: 'lead'` rows are not representable in this module at all.

### 2.4 Absence rendering: four distinct null states, and never a dash

A bare `—` or a `0` is forbidden. Each null means something different and each gets its own visual treatment and its own sentence.

**`no_record_found`** — the headline finding. We searched a named Tier 1 registry on a stated date and it returned nothing. Rendered as *content*, not as an empty cell: registry name, search date, and **both** candidate explanations stated without either being asserted.

> **Water appropriation — no permit record found.** A search of DNR's MPARS permit registry on [date] returned no water appropriation permit held by any named Minnesota data center. Two explanations are consistent with this and public records cannot currently distinguish between them: these facilities may use closed-loop or air-cooled designs that never require appropriated water, or the permits may simply not have been filed yet for projects still under construction or in review. **This is a gap in the public record, not a measurement of zero.**

Same treatment for the issued-MPCA-air-permit row, with the additional sourced fact that MPCA identifies backup diesel fleets as its regulatory touchpoint for data centers, and the Becker proceeding as the one contested proposal on record.

**`pending_verification`** — muted, non-numeric, and it names its own homework. "EPA GHGRP-reportable facility. CO2e figure pending direct retrieval from EPA FLIGHT (`ghgdata.epa.gov/flight`)." No number. This makes the backlog a visible, dated commitment rather than a silent omission, which is the same reflex CLAUDE.md §4 applies to `"No source found"`.

**`not_applicable`** — carries an explanation, and it is the state that protects the site from *understating* the case as badly as overstating it. Rendering "0 lbs" for data centers on TRI would imply a clean bill of health.

> **Toxics Release Inventory — different regulatory category.** TRI covers process chemical releases. Data centers' documented pollution exposure is combustion emissions from diesel backup generators, which are regulated as stationary engines under a separate permitting track. A data center's absence from TRI is a fact about what TRI counts, not a finding that a data center releases nothing.

**`redacted`** — not populated in v1 but present in the schema. Trade-secret withholding in PUC filings is expected on the ESA dockets, and CLAUDE.md §4 says the fact of withholding is itself publishable and often the most useful thing on the page. Whoever does the eDockets pull will need it.

---

## 3. In scope for v1

1. One data module, `src/data/mnPollutionScale.ts`, holding the rows in §2.2 with full provenance per row.
2. One comparison panel component (native `<dialog>`, `CleanGridTracker` pattern), rendering metrics as sections, each with a legacy-industrial side and a data-center side.
3. One trigger control, placement reconciled against `CleanGridBar` and `CampaignBanner`.
4. Per-row tier and confidence badges, visible in the UI, with a plain-language gloss on what each tier means (CLAUDE.md §0.9).
5. A **"What this comparison can't see"** block inside the panel, rendered from the module's own gap entries — build-time derived, not hand-written prose that can drift from the data (CLAUDE.md §5).
6. Plain-language gloss inline for ESA, TRI, GHGRP, MPARS, CON, EAW (§0.9).
7. Units on every rendered figure: tons CO2e, lbs, MW, MGD / gallons-per-day, acre-feet/year.
8. Screen-reader-first markup: the panel is a semantic table or definition list. Any chart is decorative and `aria-hidden`, with the table as the record. Respect `prefers-reduced-motion`.
9. A one-paragraph honest summary at the top of the panel, written as sourced statement, not verdict. Working draft:

> On the pollution metrics Minnesota actually measures and publishes — greenhouse gases, toxic chemical releases, permitted water withdrawal — the state's largest documented sources are taconite mining and processing, coal generation, pulp and paper, and petroleum refining. No Minnesota data center appears on any of those lists. Data centers are large on one axis: new electric generating capacity being built to serve them under Energy Sales Agreements at the PUC. On two more axes — water appropriation and issued air permits — there is no public record to compare at all.

### Explicitly out of scope for v1

- Any new map pin, marker, PMTiles archive, or `MAP_LAYER_META` entry.
- A standalone route. The site is one prerendered page (`src/pages/index.astro`) and v1 does not change that.
- Any composite score, index, rank, or "data centers are X% of Sherco" arithmetic.
- **Any CO2e estimate derived from MW.** The research doc §3 is explicit: no docket-confirmed steady-state operational draw exists for Hermantown or Pine Island, so multiplying by the 801 lbs CO2/MWh grid intensity would fabricate the input. The grid-intensity figure may be *displayed* as a labeled state fact; it may not be *multiplied by anything*. Name this prohibition in the module's header comment — it is the single most tempting derived number in the dataset.
- Amazon's "fewer than 15 hours annually" generator runtime claim, as a fact. If surfaced at all, it renders as an attributed company assertion, unaudited. Prefer omitting it from v1.
- Retrofitting `tier`/`confidence` onto the 17 existing `Project` records in `dataCenters.ts`.
- Time series. The change feed of §0.5 is a real requirement and a separate build.
- Any historical trend, per-capita normalization, or sector-share pie.

---

## 4. Seams touched

| Path | Change |
|---|---|
| `src/data/mnPollutionScale.ts` | **new** — rows, types, gap entries, header memo |
| `src/components/` (new `scale/` dir) | **new** — panel dialog + trigger, mirroring `grid/CleanGridTracker.astro` + `grid/CleanGridBar.astro` |
| `src/components/map/MapParent.astro` | one import + one placement, alongside `CleanGridTracker` at the dialog level |
| `README.md` | note the new module and its manual-refresh workflow |

Deliberately untouched: `mapLayers.ts`, `dataCenters.ts`, `overlayLayers.ts`, `projectFilters.ts`, `mapMarkers.ts`, `popupHtml.ts`, every filter component.

---

## 5. Unhappy paths

| Case | Behavior |
|---|---|
| A metric has zero publishable rows on one side | The section still renders with the absence copy from §2.4. Sections are never hidden — a hidden section is an undocumented editorial choice. |
| Every row in a metric is `pending_verification` | Section renders with names and the pull list, no numbers. Acceptable and expected for GHG in v1. |
| `value` set while `valueState !== 'published'` | Type error at `npm run check`. `npm run check` must stay at 0 errors. |
| `value` set with no `unit` | Type error. |
| A `primarySourceUrl` 404s later | Not detectable at build time in v1. Every row carries `retrievedAt` and `documentId` so a reader can re-find the document. Link-checking and document mirroring under CLAUDE.md §4 is deferred — logged as a gap. |
| JS disabled / dialog unsupported | The panel content is server-rendered inside the `<dialog>`; the trigger is a real button. Content is in the DOM and reachable by assistive tech regardless. No figure depends on client JS. |
| Slow connection / old phone | Static text and a table. No client-side data fetch, no chart library, no third-party asset (CLAUDE.md §7). If a chart is added, CSS/inline SVG only, and no island — this needs no interactivity beyond open/close, which is `<dialog>`'s own. **An island here would need a justification and does not have one.** |
| Narrow viewport | The table reflows to stacked metric cards. A horizontally-scrolling comparison table on a phone is a failure for the audience §0.7 names. |
| Someone adds a `reported` figure later | The type system rejects it. If they change `valueState` to force it through, the header memo tells them why not. This is the guardrail that matters most over time. |

---

## 6. Done criteria (observable)

1. Opening the panel shows every metric in §2.2, none hidden, each with a legacy-industrial side and a data-center side.
2. No numeric magnitude appears anywhere in the panel whose `valueConfidence` is `reported`. Verifiable by grepping the module for `valueConfidence: 'reported'` and confirming every such row's `value` is `null`.
3. No `—`, no bare `0`, and no unlabeled number anywhere in the rendered panel.
4. The water row and the air-permit row read as findings with a named registry, a search date, and both candidate explanations — not as empty cells.
5. The TRI row names all 11 facilities in order and states, in the UI, that this is rank order without verified pound figures.
6. Every rendered row shows a tier badge and a confidence badge with a plain-language gloss, plus a link to its primary source.
7. A "What this comparison can't see" block renders, derived at build time from the module's gap entries, containing at minimum the 9 gaps from the research doc §4.
8. Panel content is fully readable with JavaScript disabled and fully navigable by keyboard and screen reader; the table is the record, any chart is `aria-hidden`.
9. `npm run check` at 0 errors; `npm run build` clean.
10. A row with a magnitude but no unit, or a `reported` magnitude, fails typecheck. Confirm by trying it.
11. No new network request, no new third-party asset, no new PMTiles archive.
12. Nowhere in the panel does a single number, score, or phrase rank data centers against legacy polluters as an aggregate. Read the rendered copy specifically for this.

**v1.1, tracked from day one:** the primary re-pulls that unlock the withheld numbers — EPA FLIGHT by facility ID for Sherco / Boswell / Pine Bend; TRI Explorer by TRI facility ID for the 11; DNR MPARS for a ranked appropriator table; PUC eDockets for the Hermantown and Pine Island ESA filings and the Amazon CON order, which also yields real `documentId` values for the docket numbers currently unconfirmed (~26-159, ~26-170). The MW row in particular stays incomplete until the eDockets pull happens, and that row is the argument.

---

## 7. Open questions — not decided here

1. **CLAUDE.md §6 vs. the repo.** The doc describes `scripts/ingest/`, `public/data/`, `src/layers/registry.ts`, `types.ts`, `data.ts`, `src/lib/geo.mjs`, `authority.mjs`, `LICENSE-DATA.md`, `RUNBOOK.md`, and `npm run data` / `npm run leads`. None exist. §2.3 follows the repo, not the doc. **The maintainer should decide whether the doc describes a target state to build toward or should be amended to describe what is actually here.** Either is fine; the current mismatch means an agent following CLAUDE.md literally will produce files with nowhere to plug in.
2. **Existing Tier 4 citations.** `dataCenters.ts` sources MW figures for several facilities to `cleanview.co` (`powerCapacityMW: "2 MW (per cleanview.co...)"`), which CLAUDE.md §2 designates Tier 4, lead-lists-only, "never the `primarySource` of a published feature." Pre-existing and out of scope here, but a panel that badges tiers will make it conspicuous by contrast.
3. **Trigger placement.** Three things now want the top-centre strip: `CleanGridBar`, `CampaignBanner`, and this. Needs a design call, not an engineering one.
4. **Deep linking.** No dialog in the repo syncs to `location.hash`. A comparison table is the thing on this site most likely to be linked in an email or cited in a hearing, which argues for a shareable URL, which argues for a real route rather than a modal. Deferred, but revisit if the panel gets used the way I'd expect.
5. **Becker co-location.** Sherco (#1 GHG), Vonco II landfill (#28), and Amazon's proposed 250-generator site on the former Sherco coal ground are all in Becker. Strong, sourced, and geographic — the one part of this research that genuinely wants the map. Proposed as a note on the Becker facility's existing detail panel in v2, not as a new pin.

---

## 8. Proposed vocabulary (for `AGENTS.md` glossary or a new `CONTEXT.md`)

| Term | Meaning |
|---|---|
| **entity confidence** vs. **value confidence** | Whether a facility belongs on a list, vs. whether its number is verified. Currently collapsed into one `confidence` field, which is why Sherco has to be either fully published or fully withheld. Splitting them is what lets v1 name the facility without asserting the tonnage. |
| **value state** | `published` / `pending_verification` / `no_record_found` / `not_applicable` / `redacted`. Five different reasons a cell is empty, five different sentences. |
| **absence finding** | A documented search of a named registry that returned nothing, recorded with the registry and the search date. Distinct from a missing field and from a zero. The MPARS and MPCA-air-permit rows are the canonical instances. |
| **scale anchor** | A legacy industrial facility included solely to give a data center figure a comparable magnitude. Not a subject of the site; never a map pin. |
| **re-pull backlog** | Figures known from secondary sources and deliberately withheld pending direct retrieval from the primary. Rendered as a visible commitment, not hidden. |
| **instrument mismatch** | Two numbers in the same unit from different regulatory instruments, not comparable. Minntac's 7.2 MGD is a DEIS *discharge* projection; MPARS records *appropriation* permits. |
| **derived-figure prohibition** | A named, documented refusal to compute a specific tempting number. Here: MW × grid intensity → CO2e/yr, blocked because no steady-state draw figure exists. |
