// src/data/mnPollutionFacilities.ts
//
// Canonical facility identity + coordinates for the 16 Minnesota sites in
// `mnPollutionScale.ts`'s `TRI_TOP_FACILITIES` list (which already covers
// every site also referenced by name in `GHG_ROWS` and `WATER_ROWS` — Sherco,
// Boswell, and Pine Bend/Flint Hills appear in both places). See
// research/facility-pins-spec.md for why this is a separate file joined by
// `facilityId` rather than a restructuring of those already-reviewed arrays.
//
// ---------------------------------------------------------------------------
// COORDINATE SOURCING — read before adding or editing a row.
// ---------------------------------------------------------------------------
// Every coordinate here comes from EPA's Facility Registry Service (FRS) or,
// for the two facilities whose TRI Facility ID this project had already
// independently verified (Sherco, Flint Hills — see mnPollutionScale.ts),
// from EPA's TRI_FACILITY table via the Envirofacts REST API. Both are the
// same class of source: EPA's own facility-location registries, not a
// geocoded address and not an inferred point. Retrieved 2026-08-25.
//
// FRS facility-name search is fuzzy and large industrial sites often have
// many FRS sub-records for the same physical site — the main plant, a
// landfill, a pipeline segment, a tailings basin — each with its own
// Registry ID and sometimes coordinates a few km apart from the others. Every
// row's `frsSource` records which specific Registry ID was used and a
// `matchNote` where the match required a judgment call rather than an exact
// name match. `scripts/lookup-facility-coordinates.mjs` reproduces the
// lookup for any facility added later.
//
// Two rows carry a lower-confidence flag rather than a silent pick:
//   - Cleveland-Cliffs Minorca Mine: FRS has no current record under that
//     name with coordinates. The only coordinate-bearing record is under
//     "ArcelorMittal Minorca Mine Inc" — ArcelorMittal is the site's
//     documented predecessor operator (a public, well-known corporate
//     transition), and the county/city match, but this is a same-site
//     inference across a name change, not an exact-name match.
//   - Northshore Mining Co: matched to FRS's "Northshore Mining Company"
//     (COMPANY vs Co) rather than an exact string match — same site, same
//     city/county, treated as a confident match but noted for the record.
// No row was left out: unlike the spec's stated fallback (omit rather than
// guess), every one of the 16 resolved to a single defensible candidate on
// this pass. A future add that doesn't resolve cleanly should follow that
// fallback instead of straining a match through.

export interface FacilityFrsSource {
  /** Which EPA system the coordinate came from. */
  system: 'FRS' | 'TRI_FACILITY';
  /** FRS Registry ID, or TRI Facility ID when system is 'TRI_FACILITY'. */
  registryId: string;
  /** Set only when the matched record's name isn't an exact match to this
   * facility's canonical name — see module note above. */
  matchNote?: string;
  retrievedAt: string;
}

export interface PollutionFacility {
  /** Stable join key — referenced by `facilityId` on rows in
   * mnPollutionScale.ts's GHG_ROWS / TRI_TOP_FACILITIES / WATER_ROWS. */
  facilityId: string;
  /** Display name for the pin and detail panel. Matches (or closely mirrors)
   * the `facility` string already used in mnPollutionScale.ts. */
  name: string;
  county: string;
  sector: string;
  coordinates: [number, number]; // [lat, lon]
  frsSource: FacilityFrsSource;
}

export const POLLUTION_FACILITIES: PollutionFacility[] = [
  {
    facilityId: 'minntac',
    name: 'US Steel Corp – Minntac',
    county: 'St. Louis',
    sector: 'Taconite mining/processing',
    coordinates: [47.565, -92.6328],
    frsSource: { system: 'FRS', registryId: '110008799247', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'united-taconite-fairlane',
    name: 'United Taconite LLC – Fairlane Plant',
    county: 'St. Louis',
    sector: 'Taconite processing',
    coordinates: [47.3502, -92.5735],
    frsSource: { system: 'FRS', registryId: '110070834615', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'sherco',
    name: 'Xcel Energy – Sherburne County (Sherco)',
    county: 'Sherburne',
    sector: 'Coal power generation',
    coordinates: [45.366667, -93.894444],
    frsSource: { system: 'TRI_FACILITY', registryId: '55308NRTHR13999', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'hibbing-taconite',
    name: 'Hibbing Taconite Co',
    county: 'St. Louis',
    sector: 'Taconite processing',
    coordinates: [47.478, -92.9676],
    frsSource: { system: 'FRS', registryId: '110068961225', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'minorca-mine',
    name: 'Cleveland-Cliffs Minorca Mine',
    county: 'St. Louis',
    sector: 'Taconite mining',
    coordinates: [47.5607, -92.520349],
    frsSource: {
      system: 'FRS',
      registryId: '110056954808',
      matchNote:
        'Only coordinate-bearing FRS record for this site is registered under "ArcelorMittal Minorca Mine Inc," a documented predecessor operator, not an exact name match to "Cleveland-Cliffs Minorca Mine."',
      retrievedAt: '2026-08-25',
    },
  },
  {
    facilityId: 'boswell',
    name: 'Minnesota Power – Boswell Energy Center',
    county: 'Itasca',
    sector: 'Coal power generation',
    coordinates: [47.264087, -93.647315],
    frsSource: {
      system: 'FRS',
      registryId: '110071161466',
      matchNote: 'A second FRS record under the identical name and ~500m away also exists (110041028492); this is the more precisely georeferenced of the two.',
      retrievedAt: '2026-08-25',
    },
  },
  {
    facilityId: 'boise-white-paper',
    name: 'Boise White Paper LLC',
    county: 'Koochiching',
    sector: 'Pulp/paper',
    coordinates: [48.606, -93.4071],
    frsSource: { system: 'FRS', registryId: '110000427501', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'keetac',
    name: 'US Steel Corp – Keetac',
    county: 'St. Louis',
    sector: 'Taconite processing',
    coordinates: [47.413883, -93.062672],
    frsSource: { system: 'FRS', registryId: '110008797864', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'sappi-cloquet',
    name: 'Sappi Cloquet LLC',
    county: 'Carlton',
    sector: 'Pulp/paper',
    coordinates: [46.7239, -92.4316],
    frsSource: {
      system: 'FRS',
      registryId: '110068080891',
      matchNote: 'A second FRS record under the identical name and ~1km away also exists (110000426263).',
      retrievedAt: '2026-08-25',
    },
  },
  {
    facilityId: 'northshore-mining',
    name: 'Northshore Mining Co',
    county: 'Lake',
    sector: 'Taconite mining/processing',
    coordinates: [47.2865, -91.2611],
    frsSource: {
      system: 'FRS',
      registryId: '110000910453',
      matchNote: 'Matched to FRS\'s "Northshore Mining Company" — same site, city (Silver Bay), and county, spelled-out "Company" vs "Co."',
      retrievedAt: '2026-08-25',
    },
  },
  {
    facilityId: 'flint-hills-pine-bend',
    name: 'Flint Hills Resources Pine Bend Refinery',
    county: 'Dakota',
    sector: 'Petroleum refining',
    coordinates: [44.766667, -93.040278],
    frsSource: { system: 'TRI_FACILITY', registryId: '55164KCHRFPOBOX', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'northshore-peter-mitchell',
    name: 'Northshore Mining Co – Peter Mitchell',
    county: 'St. Louis',
    sector: 'Taconite mining',
    coordinates: [47.694302, -91.858376],
    frsSource: { system: 'FRS', registryId: '110008800048', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'american-crystal-sugar-egf',
    name: 'American Crystal Sugar – East Grand Forks',
    county: 'Polk',
    sector: 'Sugar mill',
    coordinates: [47.925833, -97.006111],
    frsSource: { system: 'FRS', registryId: '110007602095', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'southern-mn-beet-sugar',
    name: 'Southern Minnesota Beet Sugar Coop',
    county: 'Renville',
    sector: 'Sugar mill',
    coordinates: [44.797076, -95.170752],
    frsSource: {
      system: 'FRS',
      registryId: '110000594811',
      matchNote: 'Matched to FRS\'s "Southern Minnesota Beet Sugar Cooperative" (Coop vs Cooperative) at the Renville, Renville County plant site — several other FRS records under similar names are outlying agricultural collection points in different counties and were not used.',
      retrievedAt: '2026-08-25',
    },
  },
  {
    facilityId: 'xcel-allen-s-king',
    name: 'Xcel Energy – Allen S King Generating Plant',
    county: 'Washington',
    sector: 'Coal power generation',
    coordinates: [45.029468, -92.779018],
    frsSource: { system: 'FRS', registryId: '110000423612', retrievedAt: '2026-08-25' },
  },
  {
    facilityId: 'hibbard',
    name: 'Minnesota Power – Hibbard Renewable Energy Center',
    county: 'St. Louis',
    sector: 'Electricity generation via combustion',
    coordinates: [46.7338, -92.16318],
    frsSource: { system: 'FRS', registryId: '110071283864', retrievedAt: '2026-08-25' },
  },
];

export const POLLUTION_FACILITY_SECTORS: string[] = Array.from(
  new Set(POLLUTION_FACILITIES.map((f) => f.sector)),
);
