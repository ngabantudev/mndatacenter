# Minnesota Pollution Sources vs. Data Center Footprint — Sourced Comparison

**Scope note on method:** Figures below are labeled by tier per the project's sourcing rules. Where a primary document's numeric table could not be independently retrieved (several EPA/MPCA PDFs returned as non-extractable binary, or search results summarized rather than quoted), the figure is marked `confidence: reported` and the secondary source is named, or marked `not found` if no number could be verified at all. Nothing below is fabricated or interpolated.

---

## 1. Top Minnesota Pollution Sources (Ranked, by Metric)

### 1a. Toxics Release Inventory (TRI) — largest MN reporting facilities (by sector, not yet by exact lb figure per facility)

Statewide TRI figure (Tier 2 primary, confirmed): **Minnesota has 592 facilities reporting to TRI, totaling 113.1M lbs of releases** (all years/most recent aggregate as indexed).
Source: EPA TRI Explorer/National Analysis, `https://www.epa.gov/trinationalanalysis`; state summary via `https://plainenviro.com/states/minnesota` (secondary aggregator — cross-check against TRI Explorer, `confidence: reported` for the exact 113.1M figure until pulled directly from TRI Explorer's MN factsheet).

Named top MN TRI-reporting facilities, ranked by a federal regulatory filing that itself lists them in TRI-derived order (Tier 2, `confidence: corroborated` — sourced from an EPA rulemaking docket attachment, not yet cross-checked against per-facility lb totals):

| Rank | Facility | Sector | Location | Metric | Value | Year | Tier | Source URL |
|---|---|---|---|---|---|---|---|---|
| 1 | US Steel Corp – Minntac | Taconite mining/processing | Mt. Iron, St. Louis Co. | TRI ranking position | — (lbs not verified) | not specified | 2 | https://downloads.regulations.gov/EPA-R05-OAR-2024-0216-0045/attachment_1.pdf |
| 2 | United Taconite LLC – Fairlane Plant | Taconite processing | Forbes, St. Louis Co. | TRI ranking position | — | not specified | 2 | same |
| 3 | Xcel Energy – Sherburne County (Sherco) | Coal power generation | Becker | TRI ranking position | — | not specified | 2 | same |
| 4 | Hibbing Taconite Co | Taconite processing | Hibbing | TRI ranking position | — | not specified | 2 | same |
| 5 | Cleveland-Cliffs Minorca Mine | Taconite mining | Virginia, MN | TRI ranking position | — | not specified | 2 | same |
| 6 | Minnesota Power – Boswell Energy Center | Coal power generation | Cohasset | TRI ranking position | — | not specified | 2 | same |
| 7 | Boise White Paper LLC | Pulp/paper | International Falls | TRI ranking position | — | not specified | 2 | same |
| 8 | US Steel Corp – Keetac | Taconite processing | Keewatin | TRI ranking position | — | not specified | 2 | same |
| 9 | Sappi Cloquet LLC | Pulp/paper | Cloquet | TRI ranking position | — | not specified | 2 | same |
| 10 | Northshore Mining Co | Taconite mining/processing | Silver Bay | TRI ranking position | — | not specified | 2 | same |
| 11 | Flint Hills Resources Pine Bend Refinery | Petroleum refining | Rosemount | TRI ranking position | — | not specified | 2 | same |

**Gap:** Exact TRI pounds-released figures per facility for a single consistent year were not retrieved — TRI Explorer's per-state factsheet URL 404'd on the year queried, and per-facility TRI Explorer pages need the specific TRI Facility ID. This ranking (order only, not magnitude) is `confidence: corroborated`, not `confirmed`. **Action for the map feature: pull exact figures directly from TRI Explorer (`https://enviro.epa.gov/triexplorer/`) or ECHO (`https://echo.epa.gov/`) by facility ID before publishing any numeric TRI value.**

### 1b. Greenhouse gas emissions — largest MN point sources

Named facilities and figures (Tier 2 primary basis — EPA Greenhouse Gas Reporting Program, GHGRP — as reported through the Star Tribune's "Minnesota's Greenhouse 100" project, which states it derived its ranking from EPA GHGRP data). **These specific tonnage figures are `confidence: reported`** (secondary outlet citing the primary dataset) because the raw GHGRP PDF/FLIGHT record for these facilities could not be opened in this session (PDF binary/paywall issues) — re-verify directly against EPA FLIGHT (`https://ghgdata.epa.gov/flight/`) before use in a published layer.

| Rank | Facility | Owner | Location | Metric | Value | Year | Tier | Confidence | Source URL |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Sherburne County Generating Station (Sherco) | Xcel Energy | Becker | CO2e | ~11,000,000 tons | 2019 | 2 | reported | https://www2.startribune.com/minnesotas-top-100-greenhouse-polluters/600156143/ (citing EPA GHGRP) |
| 2 | Boswell Energy Center | Minnesota Power | Cohasset, Itasca Co. | CO2e | not found (numeric value not retrieved) | — | 2 | reported | same |
| 3 | Pine Bend Refinery | Flint Hills Resources | Rosemount | CO2e | ~4,000,000 tons | 2019 | 2 | reported | same |
| 12 | Southern Minnesota Beet Sugar Coop | SMBSC | Renville | CO2e | 480,507 tons | 2019 | 2 | reported | same |
| 28 | Vonco II landfill | — | Becker, Sherburne Co. | CO2e | not found | — | 2 | reported | same |
| 89 | Post Consumer Brands plant | Post Holdings | Northfield | CO2e | ~40,000 tons | 2019 | 2 | reported | same |

Notes documented in the same source (Tier 2, structural fact, `confidence: reported`): EPA GHGRP thresholds only capture facilities emitting ≥25,000 tons/yr; MPCA separately collects data from ~1,400 facilities of all sizes for the state inventory (a broader, non-threshold-gated dataset MPCA holds but whose facility-level figures could not be extracted in this session — the MPCA statewide GHG inventory PDF at `https://www.pca.state.mn.us/sites/default/files/lraq-2sy23.pdf` returned as non-extractable binary).

**Sector-level, statewide (Tier 1, MPCA/legislature-facing reporting, cited by secondary sources but not independently re-extracted here):** Transportation and agriculture, not electricity generation, are Minnesota's largest statewide GHG-emitting *sectors* overall (as opposed to single point sources) as of the most recent MPCA/Next Generation Energy Act inventory. `confidence: reported` — source: MPR News summarizing MPCA's inventory, `https://www.mprnews.org/story/2019/01/05/transportation-agriculture-edge-out-electricity-minnesota-largest-emissions-sources`; primary document: MPCA GHG inventory, `https://mn.gov/puc-stat/documents/pdf_files/MPCA-DOC%20Greenhouse%20Gas%20Inventory%20Report%20-%202021-1-14.pdf` (not independently re-extracted this session — flag for direct pull).

**Electricity sector, statewide (Tier 2, EPA/EIA, corroborated):** Minnesota's 2023 electric-power-sector CO2 emissions totaled **20,842 thousand metric tons** against **57,276,862 MWh** generated, i.e., ~801 lbs CO2/MWh. Minnesota ranked 29th among U.S. states for electricity-sector CO2 emissions in 2023.
Source: EIA Minnesota Electricity Profile 2023, `https://www.eia.gov/electricity/state/minnesota/index.php` (Tier 2, `confidence: confirmed`).

### 1c. Water appropriation — largest documented industrial withdrawals

| Facility | Sector | Location | Metric | Value | Notes | Tier | Confidence | Source |
|---|---|---|---|---|---|---|---|---|
| US Steel Minntac | Taconite processing | Mt. Iron | Discharge/appropriation | ~5,000 gpm (7.2 MGD) proposed max discharge | This is a discharge figure from a DEIS on tailings-basin water inventory reduction, not a confirmed current DNR appropriation-permit volume | 1 | reported (drawn from a draft EIS, not the live MPARS permit record) | https://www.pca.state.mn.us/sites/default/files/minntac-deis.pdf |
| Hibbing Taconite Co | Taconite processing | Hibbing | Water appropriation volume | not found | MPARS facility-level permit volumes not pulled this session | 1 | — | https://www.dnr.state.mn.us/mpars/index.html |
| Northshore Mining / other Iron Range taconite | Taconite mining | Silver Bay etc. | Water appropriation volume | not found | same | 1 | — | same |

**Gap:** DNR's MPARS system is the authoritative live registry for permitted appropriation volumes (Tier 1) but requires querying the system directly by permit number — no ranked list of MN's largest permitted water users could be assembled with verified figures (taconite processing is understood industry-wide to dominate MN's industrial appropriation volume, but there is no verified top-10 ranked table to publish). **This is a knownGaps item, not a number to guess at.**

---

## 2. Minnesota Data Center Footprint — What Is Documented

### 2a. Power / MW (PUC ESA dockets — Tier 1, strongest available data center source)

| Project | Utility | Filing entity (LLC) | Beneficial operator | Location | Metric | Value | Status/date | Tier | Confidence | Source |
|---|---|---|---|---|---|---|---|---|---|---|
| Hermantown data center | Minnesota Power | Harmony Group, LLC | Google (Alphabet) — per company confirmation | Hermantown | New generation tied to ESA | 700 MW (300 MW wind + 400 MW battery storage) | ESA filed 3/26/2026; PUC comment period open to 8/28/2026; docket ~26-159 (docket number not independently confirmed from the PDF itself — extraction failed) | 1 | reported for MW figure (news coverage of utility press release; ESA filing itself not text-extracted) | https://www.tdworld.com/utility-business/news/55362721/; https://www.datacenterdynamics.com/en/news/google-confirms-it-is-behind-403-acre-data-center-campus-in-hermantown-minnesota/ |
| Pine Island data center ("Project Skyway") | Xcel Energy | Echo Zone, LLC (per one search result) | Google (confirmed by company) | Pine Island, Goodhue Co. | Load / new generation tied to ESA | Utility-side buildout reported as up to 1,900–2,700 MW of new generation (1,400 MW wind, 200 MW solar, 300 MW battery per Xcel's own release); facility's own draw not separately confirmed | Comment period open to 9/8/2026; docket ~26-170 (not independently confirmed) | 1/2 mixed | reported | https://newsroom.xcelenergy.com/news/xcel-energy-to-power-new-google-data-center-in-minnesota; https://www.datacentermap.com/usa/minnesota/rochester-mn/project-skyway/ |
| Becker-area data center (former Sherco coal site) | Xcel Energy (site) | Amazon (self-identified) | Amazon | Becker | Backup generation only | 250 diesel generators, ~600 MW aggregate max output (each unit below the 50 MW individual permitting threshold) | PUC denied Amazon's Certificate-of-Need exemption request 3/1/2025 | 1 | confirmed (PUC order + reported detail) | https://www.datacenterfrontier.com/energy/article/55269574/minnesota-puc-says-no-to-amazons-bid-to-fast-track-250-diesel-generators-for-data-center |

**Physical size, Pine Island (Tier 3/secondary, `reported`):** ~250,000 sq ft data center + 35,000 sq ft office on an 88-acre parcel of a 482-acre site. Source: constructionowners.com / postbulletin.com coverage — not a primary filing figure, do not treat as authoritative acreage for a permit-tied layer.

**Litigation status (Tier 2, `confirmed` as a legal fact, not an environmental figure):** A Goodhue County judge issued a temporary restraining order halting construction at Pine Island on/around May 22, 2026, following a suit by the Minnesota Center for Environmental Advocacy. Source: `https://www.startruntribune.com/minnesota-data-center-pine-island-restraining-order/601849201` / Construction Dive coverage. This is directly relevant to §0.4/0.6 (routine-vs-contested framing) for the site.

### 2b. Water use — DNR MPARS permits for data center cooling

**Not found.** No DNR MPARS water appropriation permit specific to a named Minnesota data center facility was located. This is consistent with MPCA's own public messaging that water/wastewater permitting is required *if* a project uses appropriated water or discharges wastewater, but no evidence was found that any operating or under-construction MN data center currently holds a published MPARS permit record. **This is a knownGaps entry, not a zero-value data point** — it means "not yet triggered / not found," not "data centers use no water."

### 2c. Air emissions — backup generators (MPCA air permits)

- MPCA confirms explicitly (Tier 1, `confirmed`) that its regulatory touchpoint for data centers is centered on **emergency backup diesel generator fleets**, plus cooling-water/wastewater discharge and on-site fuel storage. Source: `https://www.pca.state.mn.us/data-centers`.
- **Amazon / Becker:** 250 proposed diesel generators, ~600 MW aggregate — the single largest documented MN data center backup-generation proposal found, and notable because MPCA/PUC treated the fleet's aggregate size as requiring full Certificate-of-Need review rather than a fast-tracked exemption (Tier 1, `confirmed`, PUC decision 3/1/2025). Source: Data Center Frontier, citing the PUC order (docket number not independently extracted — recommend pulling the actual PUC order from `edockets.state.mn.us` for a citable primary document ID).
- **Oppidan developer:** Reported to have halted two Minnesota data center projects specifically over the timeline for obtaining backup-generator air permits. Location/generator counts/MW for these two projects were **not found** — the Star Tribune article fetch failed to return extractable detail (needs re-fetch). Source: `https://www.startribune.com/developer-halts-two-minnesota-data-centers-over-permits-for-backup-generators/601507579` (Tier 3, secondary reporting, `confidence: reported`, figures unconfirmed).
- **CloudHQ, Chaska:** Referenced as a planned data center site seeking a large tech tenant; no generator count, MW, or permit figures found.
- **Small Eagan data center, built 2025:** Referenced in search results as "relatively small," no figures found.
- No completed/issued MPCA air permit record for a named MN data center facility (permit number, generator count, criteria-pollutant tons/yr) was retrieved. **This is a knownGaps entry.** Recommend pulling directly from MPCA's permit tracker referenced on `https://www.pca.state.mn.us/data-centers`.

---

## 3. Direct Comparison — Honest Scale Assessment

**Bottom line: at present, Minnesota's documented data center footprint is small relative to the state's largest existing industrial polluters, on every metric where a real figure exists — with one important exception (new/incremental utility-scale power buildout tied to ESAs), which is large in MW terms but is mostly clean generation (wind/solar/storage), not emissions.**

- **GHG/CO2e:** Sherco alone reported ~11M tons CO2e in 2019 (Tier 2, reported) — an order of magnitude larger than any GHG figure documented for a Minnesota data center. No MN data center has a published GHGRP-reportable CO2e figure at all; the only air-emissions-relevant data center figure found is a *generator fleet capacity* (Amazon's 600 MW of standby diesel), which is not the same thing as annual tons emitted, since these generators are represented as running only for testing/outages (Amazon's own claim, reported: "fewer than 15 hours annually" — unverified, company assertion, not independently audited, `confidence: reported`, should be flagged as a claim, not a fact, if surfaced on the site).
- **TRI / criteria pollutants:** Minnesota's top TRI list is dominated entirely by taconite mining/processing (6 of the top 11 named facilities), coal power (2), pulp/paper (2), and petroleum refining (1). Zero data center facilities appear in any TRI-adjacent ranking found — consistent with the fact that data centers are not major process-chemical dischargers; their primary criteria-pollutant exposure is combustion emissions from diesel backup generators, which is a *different* regulatory category (NSR/permit-by-rule for engines) than TRI reporting.
- **Water:** Minntac alone is associated with a ~7.2 MGD discharge figure in a DEIS. No MN data center has a documented water appropriation permit at all. This is a real asymmetry worth stating plainly on the site: it may reflect that MN's hyperscale data centers to date have not been sited with large evaporative cooling loads requiring DNR appropriation (many hyperscale designs use closed-loop or air-cooled systems), or it may simply reflect that permits haven't been filed yet for pre-construction projects. **Do not assert which explanation is true — flag both possibilities as open questions in knownGaps.**
- **Power (MW), the one axis where data centers are large:** The Hermantown (700 MW) and Pine Island (reportedly up to 1,900–2,700 MW of associated new generation) ESAs are genuinely large in MW terms — comparable in scale to the output of Minnesota's largest power plants. But this is mostly *new incremental clean generation capacity* (wind, solar, battery) that utilities are building to serve the load, not emissions. The load itself, once operating, will draw from a grid mix; MN's grid-average emissions intensity (~801 lbs CO2/MWh per EIA 2023) would be the correct multiplier to estimate an operational-phase emissions figure for a data center's *grid draw* — but no published, docket-confirmed steady-state MW draw figure (as opposed to associated new-generation buildout) was found for either Hermantown or Pine Island, so **no CO2e-per-year figure for either facility should be published without that missing number.**
- **Framing for the site (per CLAUDE.md §0.5, §1c):** The honest story is not "data centers are Minnesota's new top polluter" — the primary point-source pollution and water-withdrawal records available today show legacy industrial (taconite, coal, refining) sectors dominating by a wide, documented margin. The honest and more interesting story, consistent with the "show the water heating" principle, is: (a) data centers are triggering a fast, well-documented buildout of new MW-scale generation and standby diesel capacity that regulators are visibly still building process around (PUC's Amazon CON denial, MPCA permit-timeline delays, EQB's new data-center FAQ, active litigation at Pine Island); and (b) the water and air-emissions data that would let the public judge data centers' actual pollution footprint mostly doesn't exist yet in public records — which is itself the finding.

---

## 4. Known Gaps (required, not optional)

These should be encoded as explicit `knownGaps` entries per §5 of CLAUDE.md, not silently omitted:

1. **No exact TRI lb-released figures verified per MN facility for a single consistent year** — ranking order only, not magnitude. TRI Explorer must be queried directly by facility TRI ID before publishing numeric values.
2. **No exact GHGRP CO2e figures independently re-verified via EPA FLIGHT** for Sherco, Boswell, or Pine Bend — figures used here are secondary (Star Tribune, itself citing GHGRP). Must re-pull from `ghgdata.epa.gov/flight` before treating as `confirmed`.
3. **No DNR MPARS-sourced ranked table of Minnesota's largest permitted water appropriators.** Minntac's ~7.2 MGD figure comes from a draft EIS, not a live MPARS permit record — different instrument, different confidence.
4. **No confirmed DNR water appropriation permit exists (or was found) for any named Minnesota data center.** State explicitly: either such permits don't yet exist because thresholds/construction haven't been reached, or facilities are using non-appropriated cooling approaches — this project cannot currently distinguish between those explanations from public data.
5. **No issued MPCA air permit record (permit number, generator count, tons/yr of criteria pollutants) was retrieved for any specific, named Minnesota data center facility.** The Amazon Becker figures (250 generators, ~600 MW aggregate) are the proposal/docket-stage figures contested at the PUC, not a final issued MPCA air permit with emissions limits.
6. **Oppidan's two halted data center projects:** locations, generator counts, and MW were not retrievable in this session (article fetch did not return usable detail) — needs a direct re-fetch or local-paper follow-up.
7. **PUC docket numbers for Hermantown (Google/MN Power) and Pine Island (Google/Xcel):** approximate docket numbers (26-159, 26-170) appeared in search snippets but were not independently confirmed against the PUC eDockets system itself — must be verified at `mn.gov/puc/edockets` before use as a `documentId`.
8. **Steady-state operational MW draw** (as opposed to associated new-generation buildout) for both major pending Google ESAs was not found — this is the figure needed to compute any defensible operational-phase emissions estimate for these facilities, and none currently exists in the sources checked.
9. **MPCA's own statewide GHG inventory PDF and the full MPCA-DOC 2021 GHG Inventory Report** could not be text-extracted (returned as binary/corrupted to the fetch tool) — sector-level statewide GHG shares (transportation/agriculture vs. electricity) are `reported`, sourced through MPR News' summary, not independently re-verified against the primary MPCA document text.

---

## 5. Full Source List

**Tier 1 (Minnesota state):**
- MPCA — Data centers regulatory overview: https://www.pca.state.mn.us/data-centers
- MPCA — Sources of air pollution: https://www.pca.state.mn.us/air-water-land-climate/sources-of-air-pollution
- MPCA — Climate change trends and data: https://www.pca.state.mn.us/air-water-land-climate/climate-change-trends-and-data
- MPCA — Greenhouse gas emissions in Minnesota 2005–2020 (PDF, not fully extracted): https://www.pca.state.mn.us/sites/default/files/lraq-2sy23.pdf
- MPCA-DOC Greenhouse Gas Inventory Report 2021 (not fully extracted): https://mn.gov/puc-stat/documents/pdf_files/MPCA-DOC%20Greenhouse%20Gas%20Inventory%20Report%20-%202021-1-14.pdf
- MPCA — Minntac tailings basin water inventory DEIS: https://www.pca.state.mn.us/sites/default/files/minntac-deis.pdf
- MPCA — Mining permits: https://www.pca.state.mn.us/business-with-us/mining-permits
- MPCA — Stationary engines or generators: https://www.pca.state.mn.us/business-with-us/stationary-engines-or-generators
- Minnesota PUC — Data centers and the PUC's role: https://mn.gov/puc/activities/v-l-e-c/data-centers/index.jsp
- Minnesota PUC — Very large electric customers: https://mn.gov/puc/activities/v-l-e-c/
- Minnesota DNR — Water permitting and reporting system (MPARS): https://www.dnr.state.mn.us/mpars/index.html
- Minnesota DNR — Water use permits: https://www.dnr.state.mn.us/waters/watermgmt_section/appropriations/permits.html
- Minnesota EQB — Data centers FAQ: https://www.eqb.state.mn.us/environmental-review/data-centers-faq
- Minnesota EQB — EAW guidance: https://www.eqb.state.mn.us/environmental-review/guidance-practitioners/environmental-assessment-worksheet-eaw-guidance
- PUC eDocket filings (ESA notices), via mirror: https://legalectric.org/f/2026/04/Notice-of-Comment-Period_-20264-230494-01.pdf ; https://legalectric.org/f/2026/04/Notice-of-Objection-Period_20264-230633-01.pdf ; https://legalectric.org/f/2026/04/ESA_20263-229694-01.pdf

**Tier 2 (Federal):**
- EPA TRI National Analysis: https://www.epa.gov/trinationalanalysis
- EPA TRI Explorer: https://enviro.epa.gov/triexplorer/
- EPA regulations.gov docket (MN TRI facility list attachment): https://downloads.regulations.gov/EPA-R05-OAR-2024-0216-0045/attachment_1.pdf
- EPA GHGRP / FLIGHT: https://ghgdata.epa.gov/flight/
- EPA GHGRP Power Plants: https://www.epa.gov/ghgreporting/ghgrp-power-plants
- EIA — Minnesota Electricity Profile 2023: https://www.eia.gov/electricity/state/minnesota/index.php
- EIA — Minnesota state analysis: https://www.eia.gov/states/MN/analysis
- Minnesota PUC order on Amazon Becker generators, via Data Center Frontier: https://www.datacenterfrontier.com/energy/article/55269574/minnesota-puc-says-no-to-amazons-bid-to-fast-track-250-diesel-generators-for-data-center

**Tier 3/secondary (reported confidence only — not sole basis for any published figure):**
- Star Tribune — "Minnesota's Top Greenhouse Gas Emitting Facilities": https://www2.startribune.com/minnesotas-top-100-greenhouse-polluters/600156143/
- Star Tribune — Oppidan halts two MN data centers over generator permits: https://www.startribune.com/developer-halts-two-minnesota-data-centers-over-permits-for-backup-generators/601507579
- Star Tribune — Pine Island restraining order: https://www.startribune.com/minnesota-data-center-pine-island-restraining-order/601849201
- MPR News — Transportation, agriculture edge out electricity: https://www.mprnews.org/story/2019/01/05/transportation-agriculture-edge-out-electricity-minnesota-largest-emissions-sources
- T&D World — MN Power/Google Hermantown ESA: https://www.tdworld.com/utility-business/news/55362721/minnesota-power-reaches-agreement-to-serve-planned-google-data-center
- Data Center Dynamics — Google Hermantown confirmation: https://www.datacenterdynamics.com/en/news/google-confirms-it-is-behind-403-acre-data-center-campus-in-hermantown-minnesota/
- Xcel Energy newsroom — Pine Island announcement: https://newsroom.xcelenergy.com/news/xcel-energy-to-power-new-google-data-center-in-minnesota
- Construction Dive — Judge halts Google data center: https://www.constructiondive.com/news/judge-halts-google-data-center-project/822152/
- Trinity Consultants — Data Center Permitting in Minnesota: https://trinityconsultants.com/resources/data-center-permitting-in-minnesota/

---

## Notes for the map/visualization feature

Structured as facility-level rows with columns `facility, sector, location, metric, value, unit, year, tier, confidence, sourceUrl` — but **only the Tier 1/2 rows marked `confirmed` or `corroborated` above should be treated as publishable per CLAUDE.md §4.** Every row marked `reported` needs a direct primary-source re-pull (TRI Explorer by facility ID, EPA FLIGHT by facility ID, or the actual PUC eDocket PDF text) before it can carry a `confidence: confirmed` badge on the live site. The `knownGaps` in §4 above should become their own visible "what this map can't see" entries per §5 of CLAUDE.md — particularly the absence of any MN data center water-appropriation permit and the absence of any issued (not just proposed) MPCA air permit for a named facility.
