// src/lib/facilityMarkers.ts
//
// Pins for the ~16 legacy industrial sites in `src/data/mnPollutionFacilities.ts`
// — Minnesota's largest documented pollution sources, sited on the same map as
// data center proposals but never mixed into that marker system. See
// research/facility-pins-spec.md §2.1 for why this has to stay structurally
// separate: this is a NEW GeoJSON source (not `MARKER_SOURCE_ID`), a NEW event
// name, and a NEW popup builder, deliberately parallel to — not reusing —
// `~/lib/mapMarkers.ts`'s `Project` machinery.
//
// It is closer in spirit to `~/lib/moratoriumLayer.ts` than to the project
// marker system in one specific way: this is a hand-sourced registry compiled
// into the bundle, not a PMTiles archive, so it does not go through
// `~/lib/overlayLayers.ts` and can never report itself "unavailable." But it
// draws actual point circles, not a shaded polygon + label, which is why it
// lives in its own file rather than being folded into that one.
//
// SIZING AND COLOR — the one thing that must not happen (spec §2.5).
//
// Circle radius is driven by `cumulativeQD` (`TRI_TOP_FACILITIES`, joined by
// `facilityId`) — the regional-haze visibility-impact screening score already
// published verbatim in the source document. It is never a sum of tonnage
// across pollutants: different pollutants at wildly different toxicity added
// together would imply a "total pollution score" this project's sourcing
// rules do not support computing (CLAUDE.md §0.3, spec §2.5). A facility with
// no `TRI_TOP_FACILITIES` row (none currently, but every future add is
// checked defensively) falls back to a small fixed radius at reduced opacity,
// so "no ranking data" reads differently from "small ranking" (spec §5).
//
// Color is keyed by `sector` — a small fixed palette, legend-worthy the way
// `~/data/mapLayers.ts`'s hexes are, not a theme token, with a separate ramp
// for the dark basemap so it stays legible the way `~/lib/moratoriumLayer.ts`
// and `MapParent.astro`'s own dark-basemap handling already do (selected by
// `isMapStyleDark()`, the same switch the overlay fills use).

import type maplibregl from 'maplibre-gl';
import {
  POLLUTION_FACILITIES,
  POLLUTION_FACILITY_SECTORS,
  type PollutionFacility,
} from '~/data/mnPollutionFacilities';
import {
  GHG_ROWS,
  TRI_TOP_FACILITIES,
  TRI_SOURCE,
  WATER_ROWS,
  triProfileUrl,
  type Confidence,
  type PollutionRow,
  type Tier,
} from '~/data/mnPollutionScale';
import { escapeHtml, popupBlock } from '~/lib/popupHtml';

export const FACILITY_SOURCE_ID = 'pollution-facilities';
export const FACILITY_LAYER_ID = 'pollution-facilities-circles';
/** This controller's own map layers — exported the way
 *  `MORATORIUM_LAYER_IDS` is, for the hit test and the layer stack. */
export const FACILITY_LAYER_IDS = [FACILITY_LAYER_ID];

/** Key the master "Facilities" checkbox sends on `mapfilterchange`. */
export const FACILITY_API_KEY = 'showFacilities';
/** Key the sector sub-checkboxes send — an array of sectors currently on,
 *  not a boolean, since one master toggle governs many independent rows. */
export const FACILITY_SECTORS_API_KEY = 'facilitySectors';

/**
 * Dispatched by the accessible DOM record list (`FilterFacilities.astro`)
 * when a reader activates a facility by name rather than by clicking its pin
 * — the keyboard/screen-reader path onto the same popup a pointer click opens
 * (spec §3 item 7). Named apart from `mapmarkerselect` on purpose: that event
 * carries a `Project`, and this one must never be mistaken for it (spec
 * §2.1) — MapParent.astro's listener resolves the payload through
 * `facilityById`, never through `clientProjects`.
 */
export const FACILITY_LIST_SELECT_EVENT = 'facilitylistselect';

// ---------------------------------------------------------------------------
// Sizing: cumulativeQD, joined by facilityId, sqrt-scaled like the project
// markers (so *area*, not radius, tracks the score) but on its own domain and
// its own constants — nothing here is shared with MARKER_MIN_R/MAX_R.
// ---------------------------------------------------------------------------

const QD_BY_FACILITY_ID = new Map(
  TRI_TOP_FACILITIES.map((row) => [row.facilityId, row.cumulativeQD]),
);

const QD_VALUES = TRI_TOP_FACILITIES.map((row) => row.cumulativeQD);
const QD_MIN = Math.min(...QD_VALUES);
const QD_MAX = Math.max(...QD_VALUES);

const FACILITY_MIN_R = 5;
const FACILITY_MAX_R = 20;
/** Fixed radius for a facility with no cumulativeQD row — visibly smaller
 *  than even the lowest-ranked real score, and paired with reduced opacity
 *  (see `FACILITY_NO_QD_OPACITY`) so it reads as "no data," not "tiny." */
const FACILITY_FALLBACK_R = 4;
const FACILITY_NO_QD_OPACITY = 0.45;
const FACILITY_OPACITY = 0.88;

/** Same interpolation shape as MapParent's `radiusExpr`, on the Q/D domain. */
const qdRadiusExpr: unknown[] = [
  'interpolate',
  ['linear'],
  ['sqrt', ['get', 'cumulativeQD']],
  Math.sqrt(QD_MIN),
  FACILITY_MIN_R,
  Math.sqrt(QD_MAX),
  FACILITY_MAX_R,
];

/** Circle radius: the interpolation above where a Q/D score exists, the fixed
 *  fallback where it doesn't. */
export const FACILITY_RADIUS_EXPR: unknown[] = [
  'case',
  ['==', ['get', 'hasQD'], true],
  qdRadiusExpr,
  FACILITY_FALLBACK_R,
];

export const FACILITY_OPACITY_EXPR: unknown[] = [
  'case',
  ['==', ['get', 'hasQD'], true],
  FACILITY_OPACITY,
  FACILITY_NO_QD_OPACITY,
];

// ---------------------------------------------------------------------------
// Color: a small fixed palette keyed by sector, legend-worthy like
// mapLayers.ts's hexes — not a theme token. Every string POLLUTION_FACILITY_
// SECTORS actually contains gets its own entry; a sector added later without
// one falls back to a neutral grey rather than breaking the `match`
// expression (`match` requires every label to resolve, hence the trailing
// fallback argument both expressions below already carry).
// ---------------------------------------------------------------------------

interface SectorSwatch {
  light: string;
  dark: string;
}

const SECTOR_PALETTE: Record<string, SectorSwatch> = {
  'Taconite mining/processing': { light: '#9a4a2e', dark: '#d97757' },
  'Taconite processing': { light: '#b5651d', dark: '#e8935a' },
  'Taconite mining': { light: '#8a5a2e', dark: '#cf9a5c' },
  'Coal power generation': { light: '#3d4a5c', dark: '#8fa3bf' },
  'Pulp/paper': { light: '#2f6b45', dark: '#6fbf8c' },
  'Petroleum refining': { light: '#6b2f6b', dark: '#c07fc0' },
  'Sugar mill': { light: '#a6336b', dark: '#e58fb3' },
  'Electricity generation via combustion': { light: '#4a5a8a', dark: '#9aabe0' },
};

const FALLBACK_SWATCH: SectorSwatch = { light: '#5b5b5b', dark: '#a8a8a8' };

/** Palette entry for a sector, defensively falling back for a future sector
 *  not yet in `SECTOR_PALETTE`. */
export function sectorSwatch(sector: string): SectorSwatch {
  return SECTOR_PALETTE[sector] ?? FALLBACK_SWATCH;
}

/** All sectors this layer can render, each with the swatch its legend and its
 *  filter checkboxes both draw from — one definition, so the checkbox color,
 *  the legend swatch, and the pin color can never drift apart. */
export const FACILITY_SECTOR_SWATCHES: { sector: string; swatch: SectorSwatch }[] =
  POLLUTION_FACILITY_SECTORS.map((sector) => ({ sector, swatch: sectorSwatch(sector) }));

/** A MapLibre `match` expression keyed on `sector`, for either basemap. */
export function sectorColorExpr(dark: boolean): unknown[] {
  return [
    'match',
    ['get', 'sector'],
    ...POLLUTION_FACILITY_SECTORS.flatMap((sector) => [
      sector,
      dark ? sectorSwatch(sector).dark : sectorSwatch(sector).light,
    ]),
    dark ? FALLBACK_SWATCH.dark : FALLBACK_SWATCH.light,
  ];
}

// ---------------------------------------------------------------------------
// The GeoJSON source. Built once at module scope — this registry is fixed for
// the page's lifetime, the same reasoning `moratoriumLayer.ts` gives for its
// own `geoJson` constant.
// ---------------------------------------------------------------------------

export const FACILITY_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: POLLUTION_FACILITIES.map((facility, index) => {
    const cumulativeQD = QD_BY_FACILITY_ID.get(facility.facilityId) ?? null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [facility.coordinates[1], facility.coordinates[0]],
      },
      properties: {
        facilityIndex: index,
        facilityId: facility.facilityId,
        name: facility.name,
        sector: facility.sector,
        cumulativeQD: cumulativeQD ?? 0,
        hasQD: cumulativeQD != null,
      },
    };
  }),
};

const BY_FACILITY_ID = new Map(POLLUTION_FACILITIES.map((f) => [f.facilityId, f]));

/** Resolves a hit-tested feature back to its canonical facility record. */
export function facilityForFeature(
  feature: maplibregl.MapGeoJSONFeature,
): PollutionFacility | null {
  const id = feature.properties?.facilityId;
  return typeof id === 'string' ? (BY_FACILITY_ID.get(id) ?? null) : null;
}

export function facilityByIndex(index: number): PollutionFacility | null {
  return POLLUTION_FACILITIES[index] ?? null;
}

/** Looked up by the accessible DOM record list (spec §3 item 7) — a
 *  facilityId is what a `<button>` in that list carries in a data attribute,
 *  the same way `FilterProject.astro`'s list carries `data-project-name`. */
export function facilityById(facilityId: string): PollutionFacility | null {
  return BY_FACILITY_ID.get(facilityId) ?? null;
}

// ---------------------------------------------------------------------------
// Detail content: every sourced metric for a facility, badge-per-metric.
//
// PollutionScaleTracker.astro doesn't carry a reusable "badge" component —
// its confidence/tier vocabulary is conveyed through bar treatment (solid /
// hatched / dashed) and inline "(reported)" text, because a bar chart is the
// right register for a comparison panel. A popup has no bar to hatch, so the
// same vocabulary — tier, entityConfidence/valueConfidence, valueState — is
// rendered here as a small colored pill, styled the way moratoriumLayer.ts's
// `postureChip` already renders a status pill in a popup on this same map.
// The wording (tier labels, valueState labels) is taken directly from
// mnPollutionScale.ts's own doc comments, not invented here.
// ---------------------------------------------------------------------------

const TIER_LABEL: Record<Tier, string> = {
  1: 'Tier 1 — MN state record',
  2: 'Tier 2 — federal record',
  3: 'Tier 3 — operator-submitted',
  4: 'Tier 4 — aggregator lead',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: 'Confirmed',
  corroborated: 'Corroborated',
  reported: 'Reported',
  lead: 'Lead (unresolved)',
};

const CONFIDENCE_HEX: Record<Confidence, string> = {
  confirmed: '#2f6b45',
  corroborated: '#3d6b8a',
  reported: '#a6742e',
  lead: '#8a3d3d',
};

function badgeHtml(tier: Tier, confidence: Confidence): string {
  const hex = CONFIDENCE_HEX[confidence];
  return `
    <div class="flex flex-wrap items-center gap-1 mb-1">
      <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider"
            style="background-color: ${hex}1f; color: ${hex}">
        <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${hex}"></span>
        ${escapeHtml(CONFIDENCE_LABEL[confidence])}
      </span>
      <span class="text-[8.5px] font-semibold uppercase tracking-wide text-neutral-400">${escapeHtml(TIER_LABEL[tier])}</span>
    </div>
  `;
}

/** One metric row's value, worded the same way PollutionScaleTracker.astro's
 *  `emptyReason`/value formatting does for each `valueState`. */
function rowValueHtml(row: PollutionRow, numberFmt: Intl.NumberFormat): string {
  switch (row.valueState) {
    case 'published':
      return `<p class="text-[11px] font-bold text-neutral-900">${numberFmt.format(row.value)} ${escapeHtml(row.unit)} <span class="font-normal text-neutral-400">(${row.year})</span></p>`;
    case 'pending_verification':
      return row.approxValue != null
        ? `<p class="text-[11px] font-bold text-neutral-900">~${numberFmt.format(row.approxValue)} ${escapeHtml(row.approxUnit ?? '')} <span class="font-normal text-neutral-400">(reported, pending verification)</span></p>`
        : `<p class="text-[11px] italic text-neutral-500">Figure pending — needs a direct primary-source pull.</p>`;
    case 'no_record_found':
      return `<p class="text-[11px] italic text-neutral-500">No record found in ${escapeHtml(row.registryName)} (searched ${escapeHtml(row.searchDate)}).</p>`;
    case 'not_applicable':
      return `<p class="text-[11px] italic text-neutral-500">Not applicable — different regulatory category.</p>`;
    case 'redacted':
      return `<p class="text-[11px] italic text-neutral-500">Withheld as trade secret (${escapeHtml(row.claimedBasis)}).</p>`;
    default:
      return '';
  }
}

const numberFmt = new Intl.NumberFormat('en-US');

/** The confidence badge shows the number's own confidence where the row has
 *  one (published/pending rows), falling back to entity confidence for a row
 *  whose "value" is an absence (no_record_found/not_applicable/redacted) —
 *  same two-field distinction mnPollutionScale.ts's header documents. */
function rowConfidence(row: PollutionRow): Confidence {
  return row.valueState === 'published' || row.valueState === 'pending_verification'
    ? row.valueConfidence
    : row.entityConfidence;
}

/** One metric section — GHG, visibility ranking, or water — for a facility.
 *  Mirrors `moratoriumLayer.ts`'s `popupBlock` usage: omitted entirely, not
 *  rendered empty, when the metric doesn't apply. */
function metricSectionHtml(title: string, unit: string, row: PollutionRow): string {
  return popupBlock(
    title,
    `
      ${badgeHtml(row.tier, rowConfidence(row))}
      ${rowValueHtml(row, numberFmt)}
      <p class="mt-1 text-[10.5px] text-neutral-600 leading-snug">${escapeHtml(row.plainLanguage)}</p>
      <a href="${escapeHtml(row.primarySourceUrl)}" target="_blank" rel="noopener noreferrer"
         class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline">
        ${escapeHtml(row.documentType)} &rarr;
      </a>
      ${unit ? `<span class="hidden">${escapeHtml(unit)}</span>` : ''}
    `,
  );
}

/** The regional-haze visibility ranking section, sourced from
 *  `TRI_TOP_FACILITIES` + `TRI_SOURCE` rather than a `PollutionRow` — that
 *  table carries its own tier/confidence at the module level (`TRI_SOURCE`),
 *  not per row, so it's built separately from `metricSectionHtml` above. */
function visibilitySectionHtml(facilityId: string): string {
  const row = TRI_TOP_FACILITIES.find((r) => r.facilityId === facilityId);
  if (!row) return '';

  const triLink = row.triId
    ? `<a href="${escapeHtml(triProfileUrl(row.triId))}" target="_blank" rel="noopener noreferrer" class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline">TRI facility profile &rarr;</a>`
    : '';

  return popupBlock(
    'Regional-haze visibility ranking',
    `
      ${badgeHtml(TRI_SOURCE.tier, TRI_SOURCE.confidence)}
      <p class="text-[11px] font-bold text-neutral-900">Rank ${row.rank} of 16 — cumulative Q/D ${row.cumulativeQD.toFixed(2)}</p>
      <p class="mt-1 text-[10.5px] text-neutral-600 leading-snug">
        Not a pollution-volume figure — a screening score for potential visibility impact on
        federally protected Class I areas (SO2 + NOx + PM10 weighted by distance). See
        ${escapeHtml(row.tonnage2020.co2 ? `${numberFmt.format(row.tonnage2020.co2)} tons CO2 (2020)` : '')} for a raw tonnage figure instead.
      </p>
      <a href="${escapeHtml(TRI_SOURCE.url)}" target="_blank" rel="noopener noreferrer"
         class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline">
        EPA Region 5 regional-haze Q/D table &rarr;
      </a>
      ${triLink}
    `,
  );
}

/** Every sourced metric this project has for one facility — GHG (if
 *  present), visibility rank (if present), water appropriation (if present) —
 *  and, per spec §2.3/§5, an explicit statement rather than a silent blank
 *  when NO metric row references this facilityId at all. */
export function buildFacilityDetailHtml(facility: PollutionFacility): string {
  const ghgRow = GHG_ROWS.find((r) => r.facilityId === facility.facilityId);
  const waterRow = WATER_ROWS.find((r) => r.facilityId === facility.facilityId);
  const hasVisibility = TRI_TOP_FACILITIES.some((r) => r.facilityId === facility.facilityId);

  const sections = [
    ghgRow ? metricSectionHtml('Greenhouse gas emissions', 'tons CO2e/yr', ghgRow) : '',
    hasVisibility ? visibilitySectionHtml(facility.facilityId) : '',
    waterRow ? metricSectionHtml('Water appropriation', 'gallons/day', waterRow) : '',
  ].filter(Boolean);

  const noneFound = sections.length === 0
    ? `<p class="mt-2 pt-2 border-t border-neutral-100 text-[11px] italic text-neutral-500 leading-snug">
         No GHG, visibility-ranking, or water-appropriation row in
         <code class="text-[10px]">mnPollutionScale.ts</code> currently references this facility.
       </p>`
    : '';

  const sectorSw = sectorSwatch(facility.sector);

  return `
    <div class="p-0.5 text-neutral-900 font-sans w-full select-text">
      <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style="background-color: ${sectorSw.light}1f; color: ${sectorSw.light}">
        <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${sectorSw.light}"></span>
        ${escapeHtml(facility.sector)}
      </span>
      <h3 class="font-bold text-[14px] text-neutral-900 leading-snug mt-1.5">${escapeHtml(facility.name)}</h3>
      <p class="text-[10px] text-neutral-400 font-medium">${escapeHtml(facility.county)} County</p>
      <p class="mt-1.5 text-[9.5px] text-neutral-400 leading-snug">
        Coordinates: EPA Facility Registry Service ${escapeHtml(facility.frsSource.system)} record
        ${escapeHtml(facility.frsSource.registryId)}, retrieved ${escapeHtml(facility.frsSource.retrievedAt)}.
        ${facility.frsSource.matchNote ? escapeHtml(facility.frsSource.matchNote) : ''}
      </p>
      ${sections.join('')}
      ${noneFound}
    </div>
  `;
}

/** Compact hover card — name, sector, one-line visibility-rank fact if
 *  present, and a prompt to click. Mirrors `moratoriumLayer.ts`'s
 *  `buildHoverHtml` in register: short, disposable, no sourcing detail (that
 *  lives in the click-through detail card above). */
export function buildFacilityHoverHtml(facility: PollutionFacility): string {
  const sectorSw = sectorSwatch(facility.sector);
  const qd = QD_BY_FACILITY_ID.get(facility.facilityId);
  return `
    <div class="p-0.5 text-neutral-900 font-sans w-full select-text">
      <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style="background-color: ${sectorSw.light}1f; color: ${sectorSw.light}">
        <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${sectorSw.light}"></span>
        ${escapeHtml(facility.sector)}
      </span>
      <h3 class="font-bold text-[13px] text-neutral-900 leading-snug mt-1.5">${escapeHtml(facility.name)}</h3>
      <p class="text-[10px] text-neutral-400 font-medium">${escapeHtml(facility.county)} County</p>
      ${
        qd != null
          ? `<p class="mt-1 text-[10px] text-neutral-600 leading-snug">Regional-haze visibility ranking: cumulative Q/D ${qd.toFixed(2)}.</p>`
          : `<p class="mt-1 text-[10px] text-neutral-500 leading-snug">Not on the regional-haze visibility ranking.</p>`
      }
      <p class="mt-1 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Click for sourced metrics &rarr;</p>
    </div>
  `;
}
