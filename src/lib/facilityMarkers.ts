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
import { nf as numberFmt } from '~/lib/ratepayerWidget';

export const FACILITY_SOURCE_ID = 'pollution-facilities';
export const FACILITY_LAYER_ID = 'pollution-facilities-circles';
/** The icon symbol layer stacked on the circle layer above — a visual
 *  addition only, never a separate hit-test target. Deliberately excluded
 *  from `FACILITY_LAYER_IDS`: hit-testing (`isFacilityAt`, hover/click)
 *  stays on the circle layer, which always exists at a guaranteed minimum
 *  size, unlike the icon, whose own size expression drops to 0 on the
 *  smallest pins. */
export const FACILITY_ICON_LAYER_ID = 'pollution-facilities-icons';
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

/**
 * Dispatched by MapParent.astro's own click/hover controller — and by the
 * `FACILITY_LIST_SELECT_EVENT` handler above, so both paths converge here —
 * to open FacilityDetailParent.astro's persistent panel. Carries
 * `{ facility: PollutionFacility } | null`, `null` closing the panel, the
 * same shape `mapmarkerselect` uses for `Project`. Named apart from
 * `mapmarkerselect` for the exact reason `FACILITY_LIST_SELECT_EVENT` is:
 * that event carries a `Project` and this one must never be mistaken for it
 * (spec §2.1) — FacilityDetailParent.astro resolves this payload as a
 * `PollutionFacility`, never as a `Project`.
 */
export const FACILITY_MARKER_SELECT_EVENT = 'facilitymarkerselect';

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

// These also size the invisible hit-test circle (see MapParent.astro's
// FACILITY_LAYER_ID) — with the icon now the only visible thing on a
// facility pin, and noticeably bigger than an earlier pass per direct
// request, the tap target has to grow to match it. Otherwise a reader
// tapping the visible icon lands outside a smaller invisible hit circle
// underneath it.
const FACILITY_MIN_R = 12;
const FACILITY_MAX_R = 27;
/** Fixed radius for a facility with no cumulativeQD row — visibly smaller
 *  than even the lowest-ranked real score, and paired with reduced opacity
 *  (see `FACILITY_NO_QD_OPACITY`) so it reads as "no data," not "tiny." */
const FACILITY_FALLBACK_R = 11;
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
  // The three taconite categories used near-identical brown/orange swatches
  // (#9a4a2e/#b5651d/#8a5a2e), defeating the legend's whole purpose — a
  // reader couldn't actually tell a mine from a processing plant by pin
  // color. Spread across distinct hues instead of shades of the same one.
  // Found in review.
  'Taconite mining/processing': { light: '#9a4a2e', dark: '#d97757' },
  'Taconite processing': { light: '#c17a1f', dark: '#f0a94d' },
  'Taconite mining': { light: '#5c6b3a', dark: '#a8b878' },
  'Coal power generation': { light: '#3d4a5c', dark: '#8fa3bf' },
  'Pulp/paper': { light: '#2f6b45', dark: '#6fbf8c' },
  'Petroleum refining': { light: '#6b2f6b', dark: '#c07fc0' },
  'Sugar mill': { light: '#a6336b', dark: '#e58fb3' },
  'Electricity generation via combustion': { light: '#4a5a8a', dark: '#9aabe0' },
};

const FALLBACK_SWATCH: SectorSwatch = { light: '#5b5b5b', dark: '#a8a8a8' };

/** A 6-digit hex color with a 2-digit alpha suffix appended, for the
 *  translucent-chip backgrounds used throughout this file's badge/pill
 *  markup. Three call sites used to each hand-concatenate `${hex}1f`
 *  independently — one named helper instead, so a future palette entry that
 *  isn't a plain 6-digit hex (an 8-digit hex, a named CSS color, `rgb(...)`)
 *  fails in one place instead of silently producing invalid CSS in three.
 *  Found in review. */
function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

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
// On-pin icons — THE pin now, not a decoration on top of a colored circle.
// The circle layer (`FACILITY_LAYER_ID`, below) still exists but is fully
// transparent — kept only as a stable, guaranteed-minimum-size hit-test
// target for click/hover, per its own comment where it's built. Everything
// a reader actually sees is this icon layer: shape by sector, color by
// sector (via `icon-color`/`sectorColorExpr` on an SDF image — see
// `registerFacilityIcons`), size by Q/D rank. MapLibre circle layers can't
// carry an icon directly, so this is a `symbol` layer stacked on the same
// source, drawn from images generated at runtime on an offscreen <canvas> —
// not a bundled asset, per CLAUDE.md §7's zero-third-party-assets rule, and
// not a reuse of the lucide-astro icons the sidebar uses, which are Astro
// components with no image-file form this could hand to `map.addImage`.
//
// DELIBERATELY SIMPLE, NOT LITERAL PICTOGRAMS. Even at this layer's largest
// size a recognizable factory-with-chimney silhouette wouldn't survive
// rendering at pin scale — every glyph here is one or two bold filled
// shapes, chosen to read as a distinct mark from every other sector's glyph
// at a glance. Unlike the color-and-icon-together design this replaced,
// `FACILITY_ICON_SIZE_EXPR` now has a floor it never crosses: with the
// circle gone, the icon is the only visible thing a facility has, so it can
// never shrink to 0 the way it briefly did in an earlier pass.
//
// This function must only ever be CALLED from client-side code (MapParent.astro's
// script) — it touches `document`/canvas, which doesn't exist during Astro's
// server-side render. It's fine to *export* at module scope (nothing here
// runs until called), just never invoke it outside a browser context.
// ---------------------------------------------------------------------------

/** Stable id `map.addImage` registers each sector's icon under. */
function sectorIconImageId(sector: string): string {
  return `facility-icon-${POLLUTION_FACILITY_SECTORS.indexOf(sector)}`;
}

const ICON_CANVAS_PX = 24;

/** One bold, small-scale glyph per sector, filled in the given color on a
 *  transparent 24x24 canvas. Shapes are deliberately abstract rather than
 *  literal (see module note above) — chosen to each read as a visually
 *  distinct silhouette from the others at a glance, matching the icon used
 *  for the same sector in FilterFacilities.astro's checklist. */
function drawSectorGlyph(ctx: CanvasRenderingContext2D, sector: string, color: string): void {
  const c = ICON_CANVAS_PX / 2; // 12 — center
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (sector) {
    case 'Taconite mining/processing': {
      // Mountain: a filled triangle with a small peak notch.
      ctx.beginPath();
      ctx.moveTo(c, 4);
      ctx.lineTo(19, 19);
      ctx.lineTo(5, 19);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'Taconite processing': {
      // Factory: a body block plus a chimney block.
      ctx.fillRect(5, 12, 14, 8);
      ctx.fillRect(8, 6, 4, 8);
      break;
    }
    case 'Taconite mining': {
      // Pickaxe: two bold crossed strokes. Thicker than the original 3px —
      // at the larger render sizes this now scales up to, a stroke this
      // thin read as flimsy next to the solid-filled glyphs. Found in
      // review of the "bigger, bolder" request.
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(18, 18);
      ctx.moveTo(18, 6);
      ctx.lineTo(6, 18);
      ctx.stroke();
      break;
    }
    case 'Coal power generation': {
      // Flame: a teardrop built from two curves.
      ctx.beginPath();
      ctx.moveTo(c, 4);
      ctx.quadraticCurveTo(19, 12, 12, 20);
      ctx.quadraticCurveTo(5, 12, c, 4);
      ctx.fill();
      break;
    }
    case 'Pulp/paper': {
      // Pine tree: a filled triangle over a short trunk rect.
      ctx.beginPath();
      ctx.moveTo(c, 4);
      ctx.lineTo(18, 16);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(10, 16, 4, 4);
      break;
    }
    case 'Petroleum refining': {
      // Fuel pump: a rounded body plus a small nozzle circle.
      const radius = 2;
      const x = 7;
      const y = 6;
      const w = 8;
      const h = 13;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(17, 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'Sugar mill': {
      // Wheat: short strokes fanning off a central stem. Thicker than the
      // original 2px for the same reason the pickaxe strokes were bumped.
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(c, 5);
      ctx.lineTo(c, 19);
      for (const [dx, dy] of [
        [-5, -5],
        [5, -5],
        [-5, 1],
        [5, 1],
        [-4, 7],
        [4, 7],
      ]) {
        ctx.moveTo(c, 8 + dy);
        ctx.lineTo(c + dx, 8 + dy - 3);
      }
      ctx.stroke();
      break;
    }
    case 'Electricity generation via combustion': {
      // Lightning bolt.
      ctx.beginPath();
      ctx.moveTo(13, 3);
      ctx.lineTo(6, 13);
      ctx.lineTo(11, 13);
      ctx.lineTo(9, 21);
      ctx.lineTo(18, 10);
      ctx.lineTo(13, 10);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      // Fallback: a plain filled circle, so a future sector added to
      // POLLUTION_FACILITY_SECTORS without a case here still gets a visible
      // (if generic) mark rather than a silently blank icon.
      ctx.beginPath();
      ctx.arc(c, c, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Builds and registers one icon image per sector on `map`, safe to call
 *  repeatedly (skips a sector already registered) — called from
 *  MapParent.astro's `addDataLayer()`, which already re-runs after every
 *  basemap swap because `setStyle()` clears custom images along with
 *  everything else, the same reason that function re-adds the facility
 *  circle layer itself each time. */
export function registerFacilityIcons(map: maplibregl.Map): void {
  const register = (id: string, sector: string): void => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = ICON_CANVAS_PX;
    canvas.height = ICON_CANVAS_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Filled solid white on transparent — registered below with `sdf: true`,
    // which tells MapLibre to treat this image's alpha channel as a mask it
    // recolors per-feature via the symbol layer's own `icon-color` paint
    // property (`sectorColorExpr`, the same expression the old circle layer
    // used for `circle-color`). The actual fill color drawn here doesn't
    // matter for an SDF image — only the alpha/shape does — so one image per
    // sector still works for both basemap themes, same as before.
    drawSectorGlyph(ctx, sector, '#ffffff');
    // MapLibre's addImage() type signature doesn't accept HTMLCanvasElement
    // directly (only ImageData/ImageBitmap/HTMLImageElement) — pull the
    // pixels back out as ImageData rather than widen the type unsafely.
    map.addImage(id, ctx.getImageData(0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX), {
      pixelRatio: 2,
      sdf: true,
    });
  };
  for (const sector of POLLUTION_FACILITY_SECTORS) {
    register(sectorIconImageId(sector), sector);
  }
  // Unreachable in normal operation (see FALLBACK_ICON_ID's own doc
  // comment) but `FACILITY_ICON_EXPR`'s `match` fallback branch still
  // references it, and an unregistered image id would make MapLibre warn
  // ("Image ... could not be loaded") every render if it were ever hit.
  register(FALLBACK_ICON_ID, '__fallback__');
}

/** id of the generic circle glyph registered for a sector `match` can't
 *  resolve — reachable only if a future sector lands in the GeoJSON without
 *  a matching entry in `POLLUTION_FACILITY_SECTORS`, which shouldn't happen
 *  since that constant is itself derived from the same facility list, but
 *  `match` requires a fallback branch regardless. */
const FALLBACK_ICON_ID = 'facility-icon-fallback';

/** A MapLibre `match` expression resolving each feature's `sector` to its
 *  registered icon image id. */
export const FACILITY_ICON_EXPR: unknown[] = [
  'match',
  ['get', 'sector'],
  ...POLLUTION_FACILITY_SECTORS.flatMap((sector) => [sector, sectorIconImageId(sector)]),
  FALLBACK_ICON_ID,
];

/** Icon size. The icon IS the pin now — there's no colored circle behind it
 *  to fall back on — so unlike the size expression this replaced, it must
 *  never reach 0: every facility stays visible and tappable regardless of
 *  its Q/D rank. Interpolated on the same `FACILITY_RADIUS_EXPR` domain the
 *  old circle radius used (`FACILITY_RADIUS_EXPR` already resolves the
 *  hasQD/fallback split), remapped to a render-size floor/ceiling picked so
 *  even the smallest, bold, one-or-two-shape glyphs this file draws stay
 *  legible: ~40px across at the low end, ~90px at the high end
 *  (ICON_CANVAS_PX=24 × icon-size) — two size bumps now on direct request
 *  ("noticeably larger", then "much bigger, bolder"), roughly 2.7x the
 *  original ~15–34px pass. */
export const FACILITY_ICON_SIZE_EXPR: unknown[] = [
  'interpolate',
  ['linear'],
  FACILITY_RADIUS_EXPR,
  FACILITY_FALLBACK_R,
  1.67,
  FACILITY_MIN_R,
  1.85,
  FACILITY_MAX_R,
  3.75,
];

/** Icon-halo width/color — this is the icon layer's replacement for the old
 *  circle layer's white `circle-stroke`: a fixed-width light outline so a
 *  colored icon stays readable over both a light and a dark basemap tile
 *  underneath it, the same reasoning that stroke was hardcoded white
 *  regardless of theme. */
export const FACILITY_ICON_HALO_WIDTH = 2;
export const FACILITY_ICON_HALO_COLOR = '#ffffff';

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

// One lookup Map per metric array, built once — mirrors `BY_FACILITY_ID`
// above. `buildFacilityDetailHtml` used to scan `GHG_ROWS`/`WATER_ROWS` via
// `.find()` and `TRI_TOP_FACILITIES` via both `.some()` and a separate
// `.find()` for the same facility on every click; each of those arrays is
// tiny today, but the pattern was inconsistent with the Map already built
// for `POLLUTION_FACILITIES` two lines up. Found in review.
const GHG_BY_FACILITY_ID = new Map(
  GHG_ROWS.filter((r) => r.facilityId).map((r) => [r.facilityId as string, r]),
);
const WATER_BY_FACILITY_ID = new Map(
  WATER_ROWS.filter((r) => r.facilityId).map((r) => [r.facilityId as string, r]),
);
const TRI_BY_FACILITY_ID = new Map(TRI_TOP_FACILITIES.map((r) => [r.facilityId, r]));

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

// Plain-language labels, per CLAUDE.md §0.9 — every technical term gets its
// gloss rendered inline, not left as jargon a reader has to already know.
const TIER_LABEL: Record<Tier, string> = {
  1: 'From a Minnesota state record',
  2: 'From a federal government record',
  3: 'Self-reported by the company',
  4: 'From a lead, not yet checked',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: 'Confirmed by an official document',
  corroborated: 'Backed by two independent sources',
  reported: 'Reported, not yet double-checked',
  lead: 'Unconfirmed lead',
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
            style="background-color: ${withAlpha(hex, '1f')}; color: ${hex}">
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
      return `<p class="text-[11px] font-bold text-neutral-900">${numberFmt.format(row.value)} ${escapeHtml(row.unit)} <span class="font-normal text-neutral-400">(in ${row.year})</span></p>`;
    case 'pending_verification':
      return row.approxValue != null
        ? `<p class="text-[11px] font-bold text-neutral-900">About ${numberFmt.format(row.approxValue)} ${escapeHtml(row.approxUnit ?? '')} <span class="font-normal text-neutral-400">(a rough figure — the exact number still needs to be checked against the original document)</span></p>`
        : `<p class="text-[11px] italic text-neutral-500">No number yet — someone still needs to pull this figure from the original document.</p>`;
    case 'no_record_found':
      return `<p class="text-[11px] italic text-neutral-500">Nothing was found in ${escapeHtml(row.registryName)} (checked on ${escapeHtml(row.searchDate)}). That could mean it doesn't apply here, or that the paperwork just hasn't been filed yet.</p>`;
    case 'not_applicable':
      return `<p class="text-[11px] italic text-neutral-500">This doesn't apply to this facility, for a different reason than "no pollution" — see the note below.</p>`;
    case 'redacted':
      return `<p class="text-[11px] italic text-neutral-500">The company was allowed to keep this number secret, citing "${escapeHtml(row.claimedBasis)}" as a business secret.</p>`;
    default:
      return '';
  }
}

// `numberFmt` is `~/lib/ratepayerWidget`'s shared `nf`, imported above —
// this file used to build its own second `Intl.NumberFormat('en-US')`
// instance, the exact per-module duplication `nf` was originally extracted
// to prevent (see that file's own header). Found in review.

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
  const row = TRI_BY_FACILITY_ID.get(facilityId);
  if (!row) return '';

  const triLink = row.triId
    ? `<a href="${escapeHtml(triProfileUrl(row.triId))}" target="_blank" rel="noopener noreferrer" class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline">TRI facility profile &rarr;</a>`
    : '';

  return popupBlock(
    'How much this facility could dirty the air over nearby wild places',
    `
      ${badgeHtml(TRI_SOURCE.tier, TRI_SOURCE.confidence)}
      <p class="text-[11px] font-bold text-neutral-900">Ranked #${row.rank} out of the ${TRI_TOP_FACILITIES.length} Minnesota facilities on this list</p>
      <p class="mt-1 text-[10.5px] text-neutral-600 leading-snug">
        The federal government scores facilities on how much their smoke and exhaust could
        hazes up the view in protected wilderness areas and national parks nearby — like the
        Boundary Waters or Voyageurs National Park. The score weighs both how much a facility
        pollutes <em>and</em> how close it is to one of those protected places. It is
        <strong>not</strong> a simple "who pollutes the most" ranking — a smaller polluter
        right next to a park can outrank a bigger one far away.
        ${
          row.tonnage2020.co2
            ? `For a plainer number: this facility released about ${numberFmt.format(row.tonnage2020.co2)} tons of carbon dioxide in 2020.`
            : ''
        }
      </p>
      <a href="${escapeHtml(TRI_SOURCE.url)}" target="_blank" rel="noopener noreferrer"
         class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline">
        See the original EPA document &rarr;
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
  const ghgRow = GHG_BY_FACILITY_ID.get(facility.facilityId);
  const waterRow = WATER_BY_FACILITY_ID.get(facility.facilityId);
  const hasVisibility = TRI_BY_FACILITY_ID.has(facility.facilityId);

  const sections = [
    ghgRow ? metricSectionHtml('Climate-warming gases released', 'tons per year', ghgRow) : '',
    hasVisibility ? visibilitySectionHtml(facility.facilityId) : '',
    waterRow ? metricSectionHtml('Water taken from rivers, lakes, or wells', 'gallons per day', waterRow) : '',
  ].filter(Boolean);

  const noneFound = sections.length === 0
    ? `<p class="mt-2 pt-2 border-t border-neutral-100 text-[11px] italic text-neutral-500 leading-snug">
         This project hasn't yet found a sourced record of this facility's climate,
         air-pollution ranking, or water use — it's on this map because it's one of
         Minnesota's largest documented pollution sources by another measure.
       </p>`
    : '';

  const sectorSw = sectorSwatch(facility.sector);

  return `
    <div class="p-0.5 text-neutral-900 font-sans w-full select-text">
      <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style="background-color: ${withAlpha(sectorSw.light, '1f')}; color: ${sectorSw.light}">
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
  // One lookup for both the score and its rank — this used to be
  // `QD_BY_FACILITY_ID.get(...)` plus a second, separate `.find()` over
  // `TRI_TOP_FACILITIES` just to read `.rank`, scanning the same array twice
  // per hover. Found in review.
  const triRow = TRI_BY_FACILITY_ID.get(facility.facilityId);
  const qd = triRow?.cumulativeQD;
  return `
    <div class="p-0.5 text-neutral-900 font-sans w-full select-text">
      <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style="background-color: ${withAlpha(sectorSw.light, '1f')}; color: ${sectorSw.light}">
        <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${sectorSw.light}"></span>
        ${escapeHtml(facility.sector)}
      </span>
      <h3 class="font-bold text-[13px] text-neutral-900 leading-snug mt-1.5">${escapeHtml(facility.name)}</h3>
      <p class="text-[10px] text-neutral-400 font-medium">${escapeHtml(facility.county)} County</p>
      ${
        qd != null
          ? `<p class="mt-1 text-[10px] text-neutral-600 leading-snug">Ranked #${triRow?.rank ?? '?'} of ${TRI_TOP_FACILITIES.length} for how much it could dirty the air over nearby parks and wilderness.</p>`
          : `<p class="mt-1 text-[10px] text-neutral-500 leading-snug">Not on the state's list of biggest air-visibility impacts.</p>`
      }
      <p class="mt-1 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Click to see the full sourced record &rarr;</p>
    </div>
  `;
}
