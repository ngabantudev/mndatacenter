// src/data/mnPollutionScale.ts
//
// Minnesota's largest documented pollution sources, set against what is
// publicly documented about data centers' own footprint — power, greenhouse
// gases, toxic releases, water, and backup-generator air permits.
//
// Lives in `data/` for the same reason `mnCleanGridStandard.ts` and
// `mnRatepayerBaseline.ts` do: every row here is a citable claim, not derived
// math, and has to survive being read back in a hearing room. See
// research/mn-pollution-sources-vs-data-centers.md for the full sourced
// research this module was built from, and
// research/pollution-scale-comparison-spec.md for the feature spec that
// resolved the open questions below.
//
// ---------------------------------------------------------------------------
// WHY THIS PANEL EXISTS, AND WHAT IT IS NOT ALLOWED TO DO
// ---------------------------------------------------------------------------
// The honest finding in the research is uncomfortable in the useful
// direction: on every pollution metric Minnesota actually measures and
// publishes, legacy industrial sources (taconite mining, coal power, pulp and
// paper, refining) dominate by a documented margin, and no Minnesota data
// center appears on any of those lists. Data centers are large on exactly one
// axis — new electric generating capacity tied to PUC Energy Sales Agreement
// dockets — and that is mostly clean generation being built to serve them,
// not emissions.
//
// That is the whole argument this panel exists to make, and it only survives
// contact with a hostile reader if every number in it is either verified or
// visibly marked as not yet verified. Two rules follow from that:
//
// 1. TWO CONFIDENCE FIELDS, NOT ONE. `entityConfidence` is whether a facility
//    genuinely belongs on this list; `valueConfidence` is whether its number
//    is independently verified. Sherco belongs on the GHG list on a Tier 2
//    corroborated basis (an EPA rulemaking docket's TRI-derived ranking) but
//    its ~11M ton figure is only `reported` (Star Tribune, citing GHGRP data
//    this project could not independently re-pull). Splitting the two is what
//    lets the panel name Sherco, in rank order, without asserting the
//    tonnage as fact.
//
// 2. NO DERIVED FIGURES. In particular: never multiply a data center's MW by
//    Minnesota's grid carbon intensity to manufacture a CO2e/yr estimate. No
//    docket-confirmed steady-state operational draw exists for any pending
//    ESA, so the input to that multiplication would itself be fabricated.
//    The grid intensity figure may be displayed as a labelled state fact; it
//    may never be multiplied by anything in this module or its renderer.
//
// ---------------------------------------------------------------------------
// FIVE WAYS FOR A CELL TO BE EMPTY, AND WHY THEY ARE NOT INTERCHANGEABLE
// ---------------------------------------------------------------------------
// A bare "—" or a "0" is never correct here. `ValueState` names which kind of
// empty a row is:
//
//   published            — a real, verified number. Renders with its value
//                           and unit.
//   pending_verification — the fact is real (a facility belongs on this
//                           list) but the number comes from a secondary
//                           source and has not been independently re-pulled
//                           from the primary document. May carry an
//                           `approxValue` used ONLY to size a chart bar
//                           roughly to scale — this is not a published
//                           figure and must render with a hatched/pending
//                           treatment, never as a solid, confirmed bar.
//   no_record_found      — a named Tier 1 registry was searched on a stated
//                           date and returned nothing. This is itself a
//                           finding (see §2b/2c of the research doc) and
//                           renders as content, not as a blank.
//   not_applicable        — the metric does not apply to this subject for a
//                           stated, sourced reason (e.g. TRI covers process
//                           chemical releases, and a data center's documented
//                           pollution exposure is a different regulatory
//                           category — diesel backup generators).
//   redacted              — a filing withheld the figure as trade secret.
//                           Not populated as of this module's authoring; the
//                           state exists for whoever completes the PUC
//                           eDockets pull in the v1.1 backlog below.

export type Tier = 1 | 2 | 3 | 4;

/** How well-established a claim is. Same vocabulary as CLAUDE.md §4. */
export type Confidence = 'confirmed' | 'corroborated' | 'reported' | 'lead';

export type SubjectClass = 'legacy_industrial' | 'data_center';

export type PollutionMetric =
  | 'ghg_co2e'
  | 'tri_releases'
  | 'electric_capacity_mw'
  | 'water_appropriation'
  | 'air_permit_generators';

interface RowBase {
  facility: string;
  sector: string;
  location: string;
  subjectClass: SubjectClass;
  metric: PollutionMetric;
  /** How well-established it is that this facility belongs on this list at all. */
  entityConfidence: Confidence;
  tier: Tier;
  primarySourceUrl: string;
  documentType: string;
  /** Docket, permit, or filing number. Null where not yet independently confirmed. */
  documentId: string | null;
  retrievedAt: string;
  /** One sentence a reader with no background can repeat correctly. */
  plainLanguage: string;
}

export interface PublishedRow extends RowBase {
  valueState: 'published';
  value: number;
  unit: string;
  year: number;
  valueConfidence: 'confirmed' | 'corroborated';
}

export interface PendingVerificationRow extends RowBase {
  valueState: 'pending_verification';
  value: null;
  valueConfidence: 'reported';
  /** What still has to be pulled, and from where, before this can publish a number. */
  pendingSource: string;
  /**
   * A secondary-sourced approximate figure, carried ONLY so a chart can size
   * a bar roughly to scale. Never render this as a confirmed value — it must
   * always carry a hatched/pending visual treatment and its own "(reported,
   * pending verification)" label.
   */
  approxValue?: number;
  approxUnit?: string;
  year?: number;
}

export interface NoRecordFoundRow extends RowBase {
  valueState: 'no_record_found';
  value: null;
  registryName: string;
  searchDate: string;
  /** Both candidate explanations, stated without asserting either. */
  explanation: string;
}

export interface NotApplicableRow extends RowBase {
  valueState: 'not_applicable';
  value: null;
  explanation: string;
}

export interface RedactedRow extends RowBase {
  valueState: 'redacted';
  value: null;
  claimedBasis: string;
}

export type PollutionRow =
  | PublishedRow
  | PendingVerificationRow
  | NoRecordFoundRow
  | NotApplicableRow
  | RedactedRow;

// ---------------------------------------------------------------------------
// GREENHOUSE GAS EMISSIONS
// ---------------------------------------------------------------------------
// EPA GHGRP thresholds only capture facilities emitting ≥25,000 tons/yr. No
// Minnesota data center has been found to meet that threshold, so data
// centers do not appear on this metric at all — a `not_applicable` finding,
// not a zero.

export const GHG_ROWS: PollutionRow[] = [
  {
    facility: 'Sherburne County Generating Station (Sherco)',
    sector: 'Coal power generation',
    location: 'Becker, Sherburne Co.',
    subjectClass: 'legacy_industrial',
    metric: 'ghg_co2e',
    valueState: 'pending_verification',
    value: null,
    approxValue: 11_000_000,
    approxUnit: 'tons CO2e',
    year: 2019,
    // Facility identity is now nailed down directly in EPA's own system —
    // GHGRP Facility ID 1001024, "Sherburne County" (Xcel/Northern States
    // Power), 13999 Industrial Blvd, Becker, MN 55308. That resolves
    // `entityConfidence` to confirmed. The reported ~11M ton figure is still
    // NOT independently re-pulled — FLIGHT's facility-detail page renders via
    // client-side JS and did not return the number to an automated fetch, so
    // `valueConfidence`/`valueState` stay unchanged until someone opens
    // https://ghgdata.epa.gov/flight/details/1001024 in a browser and reads
    // the reported total off the page (or pulls it via the Envirofacts GHG
    // RESTful data service: https://www.epa.gov/enviro/greenhouse-gas-restful-data-service).
    entityConfidence: 'confirmed',
    valueConfidence: 'reported',
    tier: 2,
    pendingSource: 'EPA GHGRP Facility ID 1001024 confirmed — CO2e total still needs a direct read from ghgdata.epa.gov/flight/details/1001024 (JS-rendered; not machine-fetchable) or the Envirofacts GHG RESTful service',
    primarySourceUrl: 'https://ghgdata.epa.gov/flight/details/1001024',
    documentType: 'EPA GHGRP facility record',
    documentId: '1001024',
    retrievedAt: '2026-08-25',
    plainLanguage: "Minnesota's largest coal-fired power plant, owned by Xcel Energy.",
  },
  {
    facility: 'Pine Bend Refinery',
    sector: 'Petroleum refining',
    location: 'Rosemount, Dakota Co.',
    subjectClass: 'legacy_industrial',
    metric: 'ghg_co2e',
    valueState: 'pending_verification',
    value: null,
    approxValue: 4_000_000,
    approxUnit: 'tons CO2e',
    year: 2019,
    // UNRESOLVED: two candidate GHGRP Facility IDs were found for this site —
    // 1010504 and 1006985 — and they may not be the same facility (1010504
    // could belong to a smaller, separate Flint Hills unit rather than the
    // main Pine Bend refinery). Do not treat either as confirmed until
    // resolved by searching "Flint Hills Resources Pine Bend" directly in
    // FLIGHT's facility search (ghgdata.epa.gov/flight) rather than trusting
    // either ID secondhand.
    entityConfidence: 'corroborated',
    valueConfidence: 'reported',
    tier: 2,
    pendingSource: 'Facility ID ambiguous between 1010504 and 1006985 — resolve via FLIGHT facility search before pulling a CO2e figure',
    primarySourceUrl: 'https://www2.startribune.com/minnesotas-top-100-greenhouse-polluters/600156143/',
    documentType: 'Secondary reporting, citing EPA GHGRP',
    documentId: null,
    retrievedAt: '2026-08-25',
    plainLanguage: "Minnesota's only oil refinery, owned by Flint Hills Resources.",
  },
  {
    facility: 'Boswell Energy Center',
    sector: 'Coal power generation',
    location: 'Cohasset, Itasca Co.',
    subjectClass: 'legacy_industrial',
    metric: 'ghg_co2e',
    valueState: 'pending_verification',
    value: null,
    entityConfidence: 'corroborated',
    valueConfidence: 'reported',
    tier: 2,
    pendingSource: 'EPA GHGRP / FLIGHT (ghgdata.epa.gov/flight), by facility ID — no secondary figure was retrievable either',
    primarySourceUrl: 'https://www2.startribune.com/minnesotas-top-100-greenhouse-polluters/600156143/',
    documentType: 'Secondary reporting, citing EPA GHGRP',
    documentId: null,
    retrievedAt: '2026-08-24',
    plainLanguage: "Minnesota Power's largest coal-fired plant.",
  },
  {
    facility: 'Minnesota data centers (any named facility)',
    sector: 'Data center',
    location: 'Statewide',
    subjectClass: 'data_center',
    metric: 'ghg_co2e',
    valueState: 'not_applicable',
    value: null,
    entityConfidence: 'confirmed',
    tier: 1,
    primarySourceUrl: 'https://ghgdata.epa.gov/flight/',
    documentType: 'EPA GHGRP reporting threshold',
    documentId: null,
    retrievedAt: '2026-08-24',
    plainLanguage:
      'No Minnesota data center has been found to meet the 25,000 ton/yr GHGRP reporting threshold that would put it on this list.',
    explanation:
      "This is a fact about the threshold, not a finding that data centers emit nothing. Their documented emissions exposure is combustion from diesel backup generators, which is regulated as stationary engines — a different category from a GHGRP-reportable facility.",
  },
];

// ---------------------------------------------------------------------------
// TOXICS RELEASE INVENTORY (TRI)
// ---------------------------------------------------------------------------
// Ranked order only — exact pounds-released figures per facility were not
// independently verified for a single consistent year (TRI Explorer requires
// a per-facility TRI ID lookup with no bulk endpoint). The order itself comes
// from a federal rulemaking docket attachment and is corroborated.

export const TRI_TOP_FACILITIES: {
  rank: number;
  facility: string;
  sector: string;
  /** TRI Facility ID, where confirmed against EPA's own system — used to
   * build a direct release-profile link. Null where not yet looked up. */
  triId: string | null;
}[] = [
  { rank: 1, facility: 'US Steel Corp – Minntac', sector: 'Taconite mining/processing', triId: null },
  { rank: 2, facility: 'United Taconite LLC – Fairlane Plant', sector: 'Taconite processing', triId: null },
  { rank: 3, facility: 'Xcel Energy – Sherburne County (Sherco)', sector: 'Coal power generation', triId: '55308NRTHR13999' },
  { rank: 4, facility: 'Hibbing Taconite Co', sector: 'Taconite processing', triId: null },
  { rank: 5, facility: 'Cleveland-Cliffs Minorca Mine', sector: 'Taconite mining', triId: null },
  { rank: 6, facility: 'Minnesota Power – Boswell Energy Center', sector: 'Coal power generation', triId: null },
  { rank: 7, facility: 'Boise White Paper LLC', sector: 'Pulp/paper', triId: null },
  { rank: 8, facility: 'US Steel Corp – Keetac', sector: 'Taconite processing', triId: null },
  { rank: 9, facility: 'Sappi Cloquet LLC', sector: 'Pulp/paper', triId: null },
  { rank: 10, facility: 'Northshore Mining Co', sector: 'Taconite mining/processing', triId: null },
  { rank: 11, facility: 'Flint Hills Resources Pine Bend Refinery', sector: 'Petroleum refining', triId: '55164KCHRFPOBOX' },
];

/** Direct per-chemical release-profile link once a TRI Facility ID is known. */
export function triProfileUrl(triId: string): string {
  return `https://enviro.epa.gov/triexplorer/release_fac_profile?TRI=${triId}`;
}

export const TRI_SOURCE = {
  label: 'EPA rulemaking docket, TRI-derived facility ranking',
  documentId: 'EPA-R05-OAR-2024-0216-0045, attachment 1',
  url: 'https://downloads.regulations.gov/EPA-R05-OAR-2024-0216-0045/attachment_1.pdf',
  tier: 2 as Tier,
  confidence: 'corroborated' as Confidence,
  retrievedAt: '2026-08-24',
  note: 'Rank order only. Exact pounds-released figures per facility were not independently verified — pull directly from TRI Explorer (enviro.epa.gov/triexplorer) by facility ID before publishing a numeric value.',
};

// ---------------------------------------------------------------------------
// NEW ELECTRIC GENERATING CAPACITY — the one axis where data centers are large
// ---------------------------------------------------------------------------
// Both figures are utility press-release/trade-press sourced, not yet
// confirmed against the PUC eDocket filings themselves — the docket numbers
// below are approximate and unconfirmed. This is the row that carries the
// site's honest "data centers are large here" argument, so it stays flagged
// pending until someone completes the eDockets pull (tracked in the v1.1
// backlog).

export const MW_ROWS: PollutionRow[] = [
  {
    facility: 'Pine Island data center ("Project Skyway")',
    sector: 'Data center — new generation tied to Energy Sales Agreement',
    location: 'Pine Island, Goodhue Co.',
    subjectClass: 'data_center',
    metric: 'electric_capacity_mw',
    valueState: 'pending_verification',
    value: null,
    approxValue: 2700,
    approxUnit: 'MW',
    // Docket number now confirmed: PUC Docket 26-170 (Xcel Energy ↔
    // Google/Echo Zone, LLC), filed 2026-04-14 — that resolves
    // `entityConfidence` to confirmed. The MW figure itself is still not
    // independently verified against the filing text, so `valueConfidence`
    // stays `reported` until someone reads it off the docket at
    // mn.gov/puc/edockets. As of this writing the docket was still in public
    // comment (through 2026-09-08) — check for the Commission's final order,
    // not just the initial filing, once one issues.
    entityConfidence: 'confirmed',
    valueConfidence: 'reported',
    tier: 1,
    pendingSource: 'PUC eDockets, Docket 26-170 — MW figure needs a direct read from the filed ESA petition; comment period runs through 2026-09-08',
    primarySourceUrl: 'https://newsroom.xcelenergy.com/news/xcel-energy-to-power-new-google-data-center-in-minnesota',
    documentType: 'Utility press release / trade press',
    documentId: '26-170',
    retrievedAt: '2026-08-25',
    plainLanguage:
      "Google's Xcel-served data center near Pine Island — reported new generation up to ~2,700 MW (1,400 MW wind, 200 MW solar, 300 MW battery, plus additional capacity), mostly clean generation Xcel is building to serve the load. Under an active construction restraining order as of this writing.",
  },
  {
    facility: 'Hermantown data center',
    sector: 'Data center — new generation tied to Energy Sales Agreement',
    location: 'Hermantown, St. Louis Co.',
    subjectClass: 'data_center',
    metric: 'electric_capacity_mw',
    valueState: 'pending_verification',
    value: null,
    approxValue: 700,
    approxUnit: 'MW',
    // Docket number now confirmed: PUC Docket 26-159 (Minnesota Power ↔
    // Google/Harmony Group, LLC) — that resolves `entityConfidence` to
    // confirmed. The MW figure is still not independently verified against
    // the filing text. As of this writing the docket was still in public
    // comment (through 2026-08-28) — check for the Commission's final order,
    // not just the initial filing, once one issues.
    entityConfidence: 'confirmed',
    valueConfidence: 'reported',
    tier: 1,
    pendingSource: 'PUC eDockets, Docket 26-159 — MW figure needs a direct read from the filed ESA petition; comment period runs through 2026-08-28',
    primarySourceUrl: 'https://www.tdworld.com/utility-business/news/55362721/minnesota-power-reaches-agreement-to-serve-planned-google-data-center',
    documentType: 'Utility press release / trade press',
    documentId: '26-159',
    retrievedAt: '2026-08-25',
    plainLanguage:
      "Google's Minnesota Power-served data center — reported new generation of 700 MW (300 MW wind, 400 MW battery storage).",
  },
];

// ---------------------------------------------------------------------------
// WATER APPROPRIATION
// ---------------------------------------------------------------------------

export const WATER_ROWS: PollutionRow[] = [
  {
    facility: 'US Steel Minntac',
    sector: 'Taconite processing',
    location: 'Mt. Iron, St. Louis Co.',
    subjectClass: 'legacy_industrial',
    metric: 'water_appropriation',
    valueState: 'pending_verification',
    value: null,
    approxValue: 7_200_000,
    approxUnit: 'gallons/day',
    // A separate DNR technical report was found citing a St. Louis River
    // withdrawal rate of ~4,177 gpm (~6.0M gal/day) during its study period —
    // in the neighborhood of the 7.2M figure above but not an exact match.
    // Minntac's water accounting is genuinely split across two different
    // regulators and permit types: DNR appropriation (intake, tracked in
    // MPARS) and MPCA discharge (the tailings-basin NPDES/SDS permit,
    // reissued 2018-11-30) — so a mismatch here may mean the two published
    // figures describe different things (intake vs. discharge) rather than
    // one of them being wrong. Do not average or reconcile these two numbers;
    // report both, with their sources, until MPARS is queried directly for
    // "Minntac" / "U.S. Steel Corp" and returns the actual permitted
    // appropriation volume — the real primary-source figure for this axis.
    entityConfidence: 'confirmed',
    valueConfidence: 'reported',
    tier: 1,
    pendingSource: "DNR MPARS (mndnr.gov/mpars), searched for \"Minntac\" / \"U.S. Steel Corp\" under water appropriation permits — this figure is a draft EIS discharge projection, not a live appropriation-permit volume, and a separate DNR technical report's ~4,177 gpm (~6.0M gal/day) St. Louis River withdrawal figure does not exactly match it, which may reflect intake vs. discharge being different instruments rather than either being wrong",
    primarySourceUrl: 'https://www.pca.state.mn.us/sites/default/files/minntac-deis.pdf',
    documentType: 'Draft Environmental Impact Statement',
    documentId: null,
    retrievedAt: '2026-08-25',
    plainLanguage: "Minnesota's largest taconite operation, on tailings-basin water discharge under environmental review.",
  },
  {
    facility: 'Minnesota data centers (any named facility)',
    sector: 'Data center',
    location: 'Statewide',
    subjectClass: 'data_center',
    metric: 'water_appropriation',
    valueState: 'no_record_found',
    value: null,
    entityConfidence: 'confirmed',
    tier: 1,
    primarySourceUrl: 'https://www.dnr.state.mn.us/mpars/index.html',
    documentType: 'DNR water appropriation permit registry',
    documentId: null,
    retrievedAt: '2026-08-24',
    registryName: "DNR's MPARS water appropriation permit registry",
    searchDate: '2026-08-24',
    plainLanguage: 'No water appropriation permit was found for any named Minnesota data center.',
    explanation:
      'Two explanations are consistent with this and the public record cannot currently distinguish between them: these facilities may use closed-loop or air-cooled designs that never require appropriated water, or the permits may simply not have been filed yet for projects still under construction or in review. This is a gap in the public record, not a measurement of zero.',
  },
];

// ---------------------------------------------------------------------------
// AIR PERMITS — BACKUP GENERATORS
// ---------------------------------------------------------------------------
// MPCA's own stated regulatory touchpoint for data centers is backup diesel
// generator fleets. The Becker/Amazon proposal is the one contested case on
// record and is a confirmed regulatory decision, not an emissions figure.

export const AIR_PERMIT_ROWS: PollutionRow[] = [
  {
    facility: 'Amazon data center (former Sherco coal site)',
    sector: 'Data center — proposed backup generation',
    location: 'Becker, Sherburne Co.',
    subjectClass: 'data_center',
    metric: 'air_permit_generators',
    valueState: 'published',
    value: 250,
    unit: 'proposed diesel generators (~600 MW aggregate)',
    year: 2025,
    entityConfidence: 'confirmed',
    valueConfidence: 'confirmed',
    tier: 1,
    primarySourceUrl: 'https://www.datacenterfrontier.com/energy/article/55269574/minnesota-puc-says-no-to-amazons-bid-to-fast-track-250-diesel-generators-for-data-center',
    documentType: 'PUC order (Certificate-of-Need exemption denial)',
    documentId: null,
    retrievedAt: '2026-08-24',
    plainLanguage:
      'The PUC denied a fast-track exemption for this proposal on 2025-03-01, requiring full Certificate-of-Need review — the aggregate fleet size is what triggered that review. This is a confirmed regulatory decision about a proposal, not an issued emissions permit.',
  },
  {
    facility: 'Minnesota data centers (issued MPCA air permit)',
    sector: 'Data center',
    location: 'Statewide',
    subjectClass: 'data_center',
    metric: 'air_permit_generators',
    valueState: 'no_record_found',
    value: null,
    entityConfidence: 'confirmed',
    tier: 1,
    primarySourceUrl: 'https://www.pca.state.mn.us/data-centers',
    documentType: 'MPCA air permit tracker',
    documentId: null,
    retrievedAt: '2026-08-24',
    registryName: 'MPCA air permit records',
    searchDate: '2026-08-24',
    plainLanguage: 'No issued (as opposed to proposed) MPCA air permit was found for any named Minnesota data center.',
    explanation:
      'MPCA states its regulatory touchpoint for data centers is centered on emergency backup diesel generator fleets, cooling-water/wastewater discharge, and on-site fuel storage. The Becker proposal above is the one contested case at the proposal stage; no final issued permit with emissions limits was found for any facility.',
  },
];

export const ALL_ROWS: PollutionRow[] = [
  ...GHG_ROWS,
  ...MW_ROWS,
  ...WATER_ROWS,
  ...AIR_PERMIT_ROWS,
];

// ---------------------------------------------------------------------------
// STATEWIDE FACTS — confirmed, not tied to a single facility
// ---------------------------------------------------------------------------

/**
 * Minnesota's 2023 electric-power-sector CO2 intensity. A labelled state
 * fact only — see the derived-figure prohibition at the top of this file.
 * Never multiply this by a data center's MW to manufacture a CO2e/yr figure;
 * no docket-confirmed steady-state draw exists for any pending ESA.
 */
export const MN_GRID_CO2_INTENSITY = {
  totalCo2ThousandMetricTons: 20_842,
  totalGenerationMwh: 57_276_862,
  lbsPerMwh: 801,
  nationalRank: 29,
  year: 2023,
  sourceLabel: 'EIA Minnesota Electricity Profile 2023',
  sourceUrl: 'https://www.eia.gov/electricity/state/minnesota/index.php',
  tier: 2 as Tier,
  confidence: 'confirmed' as Confidence,
} as const;

// ---------------------------------------------------------------------------
// WHAT THIS COMPARISON CAN'T SEE
// ---------------------------------------------------------------------------
// Required per CLAUDE.md §5 — rendered as its own block, not left implicit.
// Mirrors research/mn-pollution-sources-vs-data-centers.md §4.

export interface KnownGap {
  summary: string;
  detail: string;
}

export const KNOWN_GAPS: KnownGap[] = [
  {
    summary: 'No exact TRI pounds-released figures verified per facility',
    detail:
      'The 11-facility ranking above is order only. Exact pound-released figures for a single consistent year need a direct pull from TRI Explorer by facility ID.',
  },
  {
    summary: 'GHG tonnages for Sherco, Boswell, and Pine Bend are secondary-sourced',
    detail: 'Need direct re-verification against EPA FLIGHT (ghgdata.epa.gov/flight) before they can publish as confirmed.',
  },
  {
    summary: "No ranked table of Minnesota's largest permitted water users",
    detail: "DNR's MPARS system is the authoritative live registry but requires querying by individual permit number — no bulk ranked export was available.",
  },
  {
    summary: 'No confirmed DNR water appropriation permit for any named Minnesota data center',
    detail: 'Either such permits do not yet exist because thresholds or construction have not been reached, or facilities are using non-appropriated cooling — public data cannot currently distinguish between those explanations.',
  },
  {
    summary: 'No issued MPCA air permit record for any specific, named Minnesota data center',
    detail: 'The Amazon/Becker figures are proposal/docket-stage, contested at the PUC — not a final issued permit with emissions limits.',
  },
  {
    summary: 'Two Oppidan-developed data center projects reportedly halted over generator permits',
    detail: 'Locations, generator counts, and MW were not retrievable from the available reporting — needs a direct follow-up.',
  },
  {
    summary: 'PUC docket numbers for the Hermantown and Pine Island ESAs are unconfirmed',
    detail: 'Approximate numbers appeared in search results but were not independently verified against the PUC eDockets system itself.',
  },
  {
    summary: 'No steady-state operational MW draw is published for either pending ESA',
    detail: 'This is the figure needed to compute any defensible operational-phase emissions estimate — none currently exists in the sources checked, which is why this module forbids deriving one.',
  },
  {
    summary: "MPCA's own statewide GHG inventory report could not be directly re-extracted",
    detail: 'Sector-level statewide GHG shares (transportation and agriculture exceeding electricity generation) are reported via MPR News summarizing the MPCA inventory, not independently re-verified against the primary document text.',
  },
  {
    summary: "Pine Bend Refinery's EPA GHGRP Facility ID is unresolved between two candidates",
    detail: '1010504 and 1006985 both surfaced as possible IDs; 1010504 may belong to a smaller, separate Flint Hills unit rather than the main refinery. Needs a two-second confirmation by searching "Flint Hills Resources Pine Bend" directly in FLIGHT (ghgdata.epa.gov/flight) before either can anchor a CO2e figure.',
  },
  {
    summary: "Minntac's water figures come from two sources that don't quite agree",
    detail: 'A draft EIS cites ~7.2M gal/day discharge; a separate DNR technical report cites ~4,177 gpm (~6.0M gal/day) St. Louis River withdrawal. These may be measuring different things — DNR appropriation (intake) vs. MPCA discharge are two different permits — rather than one figure being wrong. The real primary-source number is the permitted volume in DNR MPARS, not yet pulled.',
  },
];

/**
 * Manual-refresh workflow, not an ingest script — see
 * research/pollution-scale-comparison-spec.md §2.3 for why. TRI Explorer and
 * MPARS both require per-facility queries with no bulk endpoint, and this
 * dataset is ~15 rows that change at most annually. Refresh by re-running the
 * source pulls named in KNOWN_GAPS and in each row's `pendingSource`, and
 * update `retrievedAt` on whatever changes.
 */
export const LAST_REVIEWED = '2026-08-25';
