// src/lib/moratoriumLayer.ts
//
// Where each town stands on a data center moratorium, as a dot on its city
// centre — one half of the Politics section's single "Data Center
// Moratoriums" toggle. The other half is `CITY_BOUNDARIES_LAYER_ID` itself
// (~/data/mapLayers.ts), switched on alongside this by MapParent.astro's
// `handleFilterChange` so the boundary a moratorium applies across is on the
// map along with the moratoriums, rather than behind a second checkbox.
//
// It is deliberately NOT part of `~/lib/overlayLayers.ts`, which every other
// toggle goes through. That controller exists to manage PMTiles archives —
// reading a header, finding a vector layer, reporting an archive that isn't in
// the bucket. None of that applies here: this layer's data is a hand-sourced
// registry compiled into the bundle, it can never be "unavailable", and giving
// it a fake archive lifecycle to reuse the wiring would mean carrying four
// concepts that are meaningless for it. What it does share is the *shape* —
// attach/detach around a basemap swap, synchronous show/hide, and ids handed to
// the map's one hit test — so it reads the same from MapParent.
//
// TWO THINGS ARE DRAWN, and neither of them is a marker.
//
//   1. The city's own boundary, shaded in its posture's colour. This is the
//      honest rendering: a moratorium is an ordinance over a jurisdiction, and
//      the jurisdiction is that polygon. It rides on the city-boundaries
//      archive as a "companion" of that layer (see `~/lib/overlayLayers.ts`),
//      so it shares one source with the City Boundaries toggle instead of
//      parsing every tile of a statewide archive twice.
//
//      Matching is on `GNIS_FEATURE_ID`, the federal id, never on the name.
//      Minnesota has repeated city names across counties, and a near-match
//      would shade the wrong city with nothing on screen to reveal it. Every
//      id in the registry was read out of this archive.
//
//   2. The town's name, centred on that boundary — a place label, the way any
//      basemap names a city, and nothing else.
//
// There was a dot here, and it is gone. It sat at the city's centre, which is
// not city hall and not a project site, so on a map already covered in
// facility markers it made a location claim we could not support. The shaded
// boundary makes the true claim instead, and hovering it opens the record.
//
// THE LABEL IS NOT DECORATION, and this is why it survived the dot. The map
// opens at z6, where these polygons are 3–6 px across — Carver is 3.5 px, and
// North Mankato 3.3 px. A shape that small cannot be found, let alone hovered.
// The label is ~60 px of hoverable text at the same zoom, so it is both how you
// see that a town has acted and how you ask what it did. It carries no claim a
// centred city name doesn't already make.

import maplibregl from 'maplibre-gl';
import { CITY_BOUNDARIES_LAYER_ID, CITY_GNIS_FIELD } from '~/data/mapLayers';
import type { CompanionLayerSpec } from '~/lib/overlayLayers';
// Escaping and the titled block, shared with the protected-lands card. Nothing
// in the moratorium registry is meant to be markup — unlike a project's
// `businessImpact`, which is authored as HTML — so a stray angle bracket in an
// ordinance summary should render as one.
import { escapeHtml, popupBlock, chipHtml } from '~/lib/popupHtml';
import {
  MORATORIUM_ISSUE_URL,
  POSTURE_BY_ID,
  POSTURE_META,
  posturedJurisdictions,
  timelineSentence,
  type DevelopmentStatus,
  type MoratoriumPosture,
  type PosturedJurisdiction,
} from '~/data/moratoriums';

const SOURCE_ID = 'moratoriums';
const LABEL_LAYER_ID = 'moratoriums-labels';

/**
 * This controller's own map layers. Exported because MapParent stacks the
 * PMTiles fills beneath them and hands them to the map's hit test.
 */
export const MORATORIUM_LAYER_IDS = [LABEL_LAYER_ID];

/** Key this layer's toggle sends on the `mapfilterchange` event. */
export const MORATORIUM_API_KEY = 'showMoratoriums';

// One clock for the whole page load. `getPosture` takes `asOf` precisely so the
// map and the sidebar's counts can't disagree about whether a term has run
// out — see the note on that function.
const POSTURED = posturedJurisdictions();

/**
 * Two ways a hit test can hand us a town, because two layers can report one:
 * the shaded boundary, whose features come out of the tile archive and carry
 * `GNIS_FEATURE_ID`, and the label, which is ours and carries its index.
 */
const BY_GNIS = new Map(POSTURED.map((j) => [j.gnisFeatureId, j]));

export function jurisdictionForFeature(
  feature: maplibregl.MapGeoJSONFeature,
): PosturedJurisdiction | null {
  const index = feature.properties?.jurisdictionIndex;
  if (typeof index === 'number') return POSTURED[index] ?? null;

  const gnis = feature.properties?.[CITY_GNIS_FIELD];
  return typeof gnis === 'number' ? (BY_GNIS.get(gnis) ?? null) : null;
}

const geoJson = {
  type: 'FeatureCollection' as const,
  features: POSTURED.map((jurisdiction, index) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [jurisdiction.coordinates[1], jurisdiction.coordinates[0]],
    },
    properties: {
      jurisdictionIndex: index,
      name: jurisdiction.name,
      posture: jurisdiction.posture,
    },
  })),
};

// Resolved into a `match` expression rather than baked per feature, so the
// registry stays the only place a posture's colour is written down.
const POSTURE_COLOR: unknown[] = [
  'match',
  ['get', 'posture'],
  ...POSTURE_META.flatMap((m) => [m.posture, m.hex]),
  POSTURE_BY_ID.open.hex,
];

/**
 * The shaded boundary: a fill on the city-boundaries source, restricted to the
 * cities in the registry and coloured by each one's posture.
 *
 * The colour expression is keyed on `GNIS_FEATURE_ID` rather than carrying the
 * posture as a feature property, because these features come out of a tile
 * archive we don't control — there is nowhere to put a property. `match` labels
 * must be unique, and GNIS ids are, which is the second reason not to key on
 * name: two cities called the same thing would be a duplicate-label error at
 * style-load rather than a wrong shade.
 */
const TINT_COLOR: unknown[] = [
  'match',
  ['get', CITY_GNIS_FIELD],
  ...POSTURED.flatMap((j) => [j.gnisFeatureId, POSTURE_BY_ID[j.posture].hex]),
  POSTURE_BY_ID.open.hex,
];

export const MORATORIUM_TINT: CompanionLayerSpec = {
  id: 'moratorium-tint',
  baseId: CITY_BOUNDARIES_LAYER_ID,
  filter: [
    'in',
    ['get', CITY_GNIS_FIELD],
    ['literal', POSTURED.map((j) => j.gnisFeatureId)],
  ],
  paint: {
    'fill-color': TINT_COLOR,
    // Heavy enough to name a colour at a glance across the whole state, light
    // enough that the basemap's roads and water still read through it — this
    // shading is an answer about a place, not a replacement for it.
    'fill-opacity': 0.42,
    // A hairline edge in the same colour, which is all a highlighted polygon
    // needs and costs no extra layer. The city's own border, when that toggle
    // is on, draws over this in the flag's dark blue.
    'fill-outline-color': TINT_COLOR,
  },
};

/** The posture pill both popups open with. */
// Now a thin call into popupHtml.ts's shared `chipHtml` — this used to build
// the identical markup by hand; see that function's doc comment. Found in
// review, alongside the same duplication in facilityMarkers.ts's `badgeHtml`.
const postureChip = (posture: MoratoriumPosture): string => {
  const meta = POSTURE_BY_ID[posture];
  return chipHtml(meta.hex, meta.label);
};

/** Hover: what it is and that there is more. Popups sit on white — see global.css. */
function buildHoverHtml(jurisdiction: PosturedJurisdiction): string {
  const timeline = timelineSentence(jurisdiction);
  return `
    <div class="p-0.5 text-neutral-900 font-sans w-56 select-text">
      ${postureChip(jurisdiction.posture)}
      <h3 class="font-bold text-[13px] text-neutral-900 leading-snug mt-1.5">${escapeHtml(jurisdiction.name)}</h3>
      <p class="text-[10px] text-neutral-400 font-medium">${escapeHtml(jurisdiction.county)}</p>
      ${
        timeline
          ? `<p class="mt-1 text-[11px] text-neutral-600 leading-snug">${escapeHtml(timeline)}</p>`
          : ''
      }
      <p class="mt-1.5 text-[10px] text-neutral-500 leading-snug">Shaded area = the city this applies across.</p>
      <p class="mt-1 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Click for the ordinance &rarr;</p>
    </div>
  `;
}

const DEVELOPMENT_LABEL: Record<DevelopmentStatus, string> = {
  proposed: 'Data center proposed',
  approved: 'Data center approved',
  denied: 'Application denied',
  none: 'No data center on record',
  unknown: 'Not sourced yet',
};

/** Click: the whole record, with the sources every date in it came from. */
function buildDetailHtml(jurisdiction: PosturedJurisdiction): string {
  const timeline = timelineSentence(jurisdiction);

  // An unsourced development record renders as an explicit gap with a way to
  // fill it, the same treatment an unsourced serving utility gets. "We don't
  // know yet" and "there is nothing here" are different facts.
  const development =
    jurisdiction.development === 'unknown'
      ? `<p class="text-[11px] text-neutral-500 leading-snug">Whether a data center is advancing here is not sourced yet.
           <a href="${MORATORIUM_ISSUE_URL}" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-600 hover:underline">Know? Tell us &rarr;</a></p>`
      : `<p class="text-[11px] font-semibold text-neutral-800">${DEVELOPMENT_LABEL[jurisdiction.development]}</p>
         ${
           jurisdiction.developmentNote
             ? `<p class="mt-0.5 text-[11px] text-neutral-600 leading-snug">${escapeHtml(jurisdiction.developmentNote)}</p>`
             : ''
         }`;

  const sources = jurisdiction.sources
    .map(
      (source) => `
        <li>
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"
             class="text-[11px] font-medium text-blue-600 hover:underline leading-snug">
            ${escapeHtml(source.title)} &rarr;
          </a>
        </li>
      `,
    )
    .join('');

  return `
    <div class="p-0.5 text-neutral-900 font-sans w-72 select-text">
      ${postureChip(jurisdiction.posture)}
      <h3 class="font-bold text-[15px] text-neutral-900 leading-snug mt-1.5">${escapeHtml(jurisdiction.name)}</h3>
      <p class="text-[10px] text-neutral-400 font-medium">${escapeHtml(jurisdiction.county)}</p>

      ${popupBlock('Timeline', timeline ? `<p class="text-[11px] font-semibold text-neutral-800 leading-snug">${escapeHtml(timeline)}</p>` : null)}
      ${popupBlock('What It Covers', jurisdiction.scope ? `<p class="text-[11px] text-neutral-600 leading-snug">${escapeHtml(jurisdiction.scope)}</p>` : null)}
      ${popupBlock('Development', development)}
      ${popupBlock('Contested', jurisdiction.contest ? `<p class="text-[11px] text-neutral-600 leading-snug">${escapeHtml(jurisdiction.contest)}</p>` : null)}
      ${popupBlock('Sources', `<ul class="flex flex-col gap-1">${sources}</ul>`)}
    </div>
  `;
}

/**
 * Rendered cards, keyed `variant:id`. At module scope rather than per
 * controller: the registry these are built from is fixed for the page's
 * lifetime, so a card survives the map being torn down and rebuilt — and the
 * hover card would otherwise be reassembled on every frame the pointer moves
 * across a city.
 */
const popupCache = new Map<string, string>();

/** The card for a town, built at most once per variant. */
export function moratoriumPopupHtml(
  jurisdiction: PosturedJurisdiction,
  variant: 'hover' | 'detail',
): string {
  const key = `${variant}:${jurisdiction.id}`;
  let html = popupCache.get(key);
  if (html === undefined) {
    html =
      variant === 'hover'
        ? buildHoverHtml(jurisdiction)
        : buildDetailHtml(jurisdiction);
    popupCache.set(key, html);
  }
  return html;
}

export interface MoratoriumLayerOptions {
  /** Map layer ids this layer must stay beneath, bottom-first. */
  layersAbove: string[];
}

export interface MoratoriumLayer {
  /** Call once the style is loaded, and again after every basemap swap. */
  attachToStyle(): void;
  /** Call before `setStyle` — these layers belong to the style being replaced. */
  detachFromStyle(): void;
  setVisible(visible: boolean): void;
  /** Layer ids currently on the map and visible, for the map's hit test. */
  visibleLayerIds(): string[];
}

export function createMoratoriumLayer(
  map: maplibregl.Map,
  { layersAbove }: MoratoriumLayerOptions,
): MoratoriumLayer {
  let wanted = false;
  let styleReady = false;
  /** Memoized `visibleLayerIds()`, dropped by every `apply()`. */
  let visibleIds: string[] | null = null;

  const add = (): void => {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geoJson });

    const before = layersAbove.find((id) => map.getLayer(id));

    map.addLayer(
      {
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold'],
          'text-size': 11,
          // Centred on the city, with no offset — which is what makes this a
          // place label rather than the caption of a marker that is no longer
          // there.
          'text-anchor': 'center',
          // Town names collide at statewide zoom: Mankato and North Mankato
          // are four miles apart, and at z6 their polygons are 6 px and 3 px
          // wide. Dropping one is the right call for a label — the shading
          // underneath still shows both towns have acted.
          'text-allow-overlap': false,
          // Widens the hit target well past the glyphs, which is the whole
          // reason this layer is hoverable: it stands in for a 3-px polygon.
          'text-padding': 4,
        },
        paint: {
          'text-color': '#ffffff',
          // Haloed in the town's own posture colour rather than flat black, so
          // a name carries its answer even where the shading beneath it is too
          // small to see. Widened to keep white text legible against it.
          'text-halo-color': POSTURE_COLOR as any,
          'text-halo-width': 1.8,
        },
      } as maplibregl.SymbolLayerSpecification,
      before,
    );
  };

  /**
   * Bring the map in line with `wanted`. Synchronous and idempotent, like the
   * overlay controller's — there is nothing to await here, so switching the
   * layer off lands on the same tick as the click.
   */
  const apply = (): void => {
    if (!styleReady) return;
    visibleIds = null;

    if (!map.getLayer(LABEL_LAYER_ID)) {
      // Nothing to hide, and nothing worth building until it's asked for: a
      // visitor who never opens the Politics section never pays for this
      // source or its layer.
      if (wanted) add();
      return;
    }

    const visibility = wanted ? 'visible' : 'none';
    for (const id of MORATORIUM_LAYER_IDS) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  };

  return {
    attachToStyle: () => {
      styleReady = true;
      apply();
    },
    detachFromStyle: () => {
      styleReady = false;
      visibleIds = null;
    },
    setVisible: (visible) => {
      if (wanted === visible) return;
      wanted = visible;
      apply();
    },
    // Memoized, because the map's hover handler asks once per frame. Empty
    // while detached, for the same reason the overlay controller's is: naming
    // a layer that belongs to a style being swapped out makes
    // `queryRenderedFeatures` error and return nothing, taking the marker hit
    // test down with it.
    visibleLayerIds: () =>
      styleReady && wanted
        ? (visibleIds ??= MORATORIUM_LAYER_IDS.filter((id) => map.getLayer(id)))
        : [],
  };
}
