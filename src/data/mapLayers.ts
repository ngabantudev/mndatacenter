// src/data/mapLayers.ts
//
// The overlay layers, defined once. This registry previously lived in two
// places that had to be edited together: `MapParent.astro` held the PMTiles
// file names and fill paint, `FilterLayer.astro` held the toggle ids, labels,
// and event keys, and `MapParent`'s `handleFilterChange` re-listed all three
// `showX` keys by hand. Adding a fourth layer meant four coordinated edits in
// two files with nothing linking them but matching strings.
//
// Now three sides derive from `MAP_LAYER_META`: this registry, the sidebar
// rows, and `~/lib/overlayLayers.ts`, which owns everything about putting these
// on the map. The only thing the sidebar still owns is its icon and Tailwind
// swatch classes — see FilterLayer.astro for why those can't live here.

import { indexBy } from '~/lib/collections';

/**
 * Which sidebar section an overlay belongs to.
 *
 * Not cosmetic grouping: each answers a different question. A climate layer
 * says what a site would sit on top of; a politics layer says who decides
 * whether it gets built there and what they have decided so far; a pollution
 * layer says who else nearby is already a documented pollution source, for
 * scale — not a thing a data center sits on, not a decision-maker, but
 * comparison context. Someone looking for the second used to have to read
 * past four environmental datasets to find "City Boundaries"; the same
 * problem was starting for the third, since "Facilities" (legacy pollution
 * sources — see research/facility-pins-spec.md) isn't really either of the
 * other two things and was sitting inside `climate` only because that's
 * where it was first built, not because it belonged there.
 */
export type MapLayerGroup = 'climate' | 'politics' | 'pollution';

/**
 * Accordion heading per group. A total `Record` rather than the array-plus-
 * `indexBy` pair the other registries use, because a group carries exactly one
 * field and the map from key to it is the whole registry — and being total over
 * the union means a call site can't be handed an `undefined` to guard against.
 */
export const MAP_LAYER_GROUP_TITLE: Record<MapLayerGroup, string> = {
  climate: 'Climate & Regional Impacts',
  pollution: 'Pollution Sources',
  politics: 'Politics',
};

/**
 * A stroked outline drawn per polygon, on its own line layer above the fill.
 *
 * `fill-outline-color` can only ever be a one-pixel hairline at the *tile*
 * resolution, which is why the city boundaries read as a single lilac wash
 * rather than as ~850 separate jurisdictions: at statewide zoom the hairline
 * between two adjacent cities is thinner than the translucent fill either side
 * of it. A real line layer takes a width and scales it with zoom, so every
 * city keeps its own visible edge.
 */
export interface LayerOutline {
  /** Stroke width in px at low zoom; doubles by `~/lib/overlayLayers.ts` at z12. */
  width: number;
  opacity: number;
}

export interface MapLayerMeta {
  /** Stable key. Source/layer ids on the map are derived as `${id}-source|-layer`. */
  id: string;
  /** Which sidebar accordion this layer's toggle appears under. */
  group: MapLayerGroup;
  /** DOM id of the sidebar checkbox. */
  toggleId: string;
  /** Key this layer's toggle sends on the `mapfilterchange` event. */
  apiKey: string;
  label: string;
  /** One line on why this overlay matters to the campaign, shown under the label. */
  description: string;
  /** PMTiles archive in the tile bucket. */
  fileName: string;
  /** Fill colour — layer *identity*, deliberately outside the theme tokens. */
  hex: string;
  fillOpacity: number;
  outlineHex: string;
  /**
   * Fill/outline used instead of `hex`/`outlineHex` while the active basemap
   * is dark (see `isMapStyleDark` in `~/data/mapStyles.ts`). Optional because
   * most of these fills are translucent saturated hues that read fine on any
   * background — only a colour tuned to sit *under* a light basemap (a
   * near-black outline, say) needs a second value. Falls back to the light
   * pair when unset; see `fillColorFor` / `outlineColorFor`.
   */
  darkHex?: string;
  darkOutlineHex?: string;
  /**
   * Draw each polygon's border on its own line layer in `outlineHex`. Without
   * it the layer falls back to `fill-outline-color`, which is the right call
   * for a dataset read as regions (protected land, a recharge area) and the
   * wrong one for a dataset read as *borders*. See `LayerOutline`.
   */
  outline?: LayerOutline;
  /**
   * Set on a layer that has no sidebar row of its own because another control
   * switches it on — today, City Boundaries, folded into the "Data Center
   * Moratoriums" toggle (`~/components/filter/FilterMoratorium.astro`) so one
   * click shows the boundary a moratorium applies across along with the
   * moratoriums themselves, rather than asking a visitor to find and enable
   * two separate rows to get one picture. The registry entry stays — the
   * archive, its fill/outline colours, and its companion (the moratorium
   * tint) still need it — only the row in `FilterLayer.astro` disappears.
   */
  manualToggle?: boolean;
  /**
   * Credit line for this dataset, shown in the map's attribution control
   * while the layer is switched on. Optional only so a layer can be wired
   * before its archive exists — shipping one without a credit is not an
   * option, and `~/lib/overlayLayers.ts` warns in dev when it's missing.
   */
  attribution?: string;
}

/**
 * Named because a second layer draws from this one's source and vector layer —
 * the moratorium tint in `~/lib/moratoriumLayer.ts` shades the specific cities
 * that have acted. A companion pointing at a base by string literal is exactly
 * the class of link this registry exists to remove.
 */
export const CITY_BOUNDARIES_LAYER_ID = 'city-boundaries';

/**
 * Named for the same reason: `~/lib/protectedLands.ts` reads this layer's
 * features apart from every other overlay's, because this archive alone carries
 * a full attribute record per polygon.
 */
export const PROTECTED_LANDS_LAYER_ID = 'protected-lands';

/**
 * Attribute in the city-boundaries archive holding each city's federal GNIS
 * feature id — a stable number, unlike `FEATURE_NAME`, which repeats across
 * counties. It is what the moratorium tint matches on.
 */
export const CITY_GNIS_FIELD = 'GNIS_FEATURE_ID';

export const MAP_LAYER_META: MapLayerMeta[] = [
  {
    id: PROTECTED_LANDS_LAYER_ID,
    group: 'climate',
    toggleId: 'mf-toggle-protected',
    apiKey: 'showProtectedLands',
    label: 'Protected Lands',
    description: 'Conservation and public land a site would border or displace.',
    fileName: 'PADUS4_1Combined_StateMN.pmtiles',
    hex: '#10b981',
    fillOpacity: 0.4,
    outlineHex: '#047857',
    attribution:
      'Protected areas: <a href="https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-overview" target="_blank" rel="noopener">USGS PAD-US 4.1</a>',
  },
  {
    id: 'drinking-water',
    group: 'climate',
    toggleId: 'mf-toggle-drinking',
    apiKey: 'showDrinkingWater',
    label: 'Drinking Water Supply',
    description: 'DWSMA recharge areas — where cooling draw hits the aquifer.',
    fileName: 'Drinking_Water_Supply_Management_Area_(DWSMA).pmtiles',
    hex: '#3b82f6',
    fillOpacity: 0.35,
    outlineHex: '#1d4ed8',
    attribution:
      'Drinking Water Supply Management Areas: <a href="https://gisdata.mn.gov/" target="_blank" rel="noopener">Minnesota Geospatial Commons</a>',
  },
  {
    // The one layer whose *edges* are the data. Every other overlay answers
    // "what is under this site"; this one answers "whose council votes on it",
    // and that question is settled entirely by which line a parcel falls
    // inside of. So it draws a real border per city rather than relying on the
    // fill's hairline — see `outline` in MapLayerMeta for why that could never
    // work here.
    //
    // Styled after the state's own published map of this dataset (the MnGeo /
    // ArcGIS "City Boundaries in Minnesota" explore view): a translucent wash
    // inside a firmer border. The two blues are the 2024 state flag's, from the
    // State Emblems Redesign Commission's specification — Water Blue (PMS 305)
    // for the wash, Night Sky Blue (PMS 648) for the border. Someone who has
    // been reading the county's GIS viewer should recognise this layer on
    // sight, and it should still read as Minnesota's.
    //
    // WHERE IT STILL DIFFERS FROM THE STATE'S VIEWER, and it isn't the styling:
    // this archive was tiled to maxzoom 5. Past there MapLibre overzooms — it
    // keeps stretching z5 tiles rather than fetching finer ones — so a border
    // that is a smooth municipal line on gis.data.mn.gov is visibly faceted
    // here by the time you are looking at one city. Nothing in this file can
    // fix that; it needs the archive re-run through tippecanoe at a higher
    // maxzoom (z10–z12) and re-uploaded, which is also the cheapest single
    // improvement available to this layer.
    //
    // NO ROW OF ITS OWN (`manualToggle`): every city's boundary is what a
    // moratorium's shaded polygon is a *subset* of, so the two are switched
    // together by "Data Center Moratoriums" — see `manualToggle` above and
    // `FilterMoratorium.astro`.
    id: CITY_BOUNDARIES_LAYER_ID,
    group: 'politics',
    toggleId: 'mf-toggle-cities',
    apiKey: 'showCityBoundaries',
    label: 'City Boundaries',
    description: 'Which council votes on the permit.',
    manualToggle: true,
    fileName: 'convertedCity_Boundaries_in_Minnesota.pmtiles',
    hex: '#52c9e8',
    // Light enough to read 906 overlapping-at-a-glance polygons through, heavy
    // enough that the inside of a border is visibly part of the layer — which
    // is also what makes it discoverable that hovering a city names it. Reads
    // fine unchanged on a dark basemap — it's already a light colour going
    // translucent over a background, not a dark one going invisible.
    fillOpacity: 0.18,
    outlineHex: '#002d5d',
    // The flag's Night Sky Blue is near-black, which is exactly what a dark
    // basemap is made of — the same failure the sidebar swatch avoids by
    // switching off pure ink in `FilterLayer.astro`. Sky-300, close enough to
    // the fill's own hue to still read as one layer, stands out against every
    // dark basemap this site ships (`fiord`, `dark`) the way the navy does
    // against the light ones.
    darkOutlineHex: '#7dd3fc',
    outline: { width: 0.8, opacity: 0.9 },
    attribution:
      'City boundaries: <a href="https://gisdata.mn.gov/" target="_blank" rel="noopener">Minnesota Geospatial Commons</a>',
  },
  {
    // Amber, matching the co-op chip in the ratepayer widget — a member
    // should be able to see the shading under a facility and the "Member-Owned
    // Co-op" badge in the drawer as one claim.
    //
    // NOTE: this archive is not in the tile bucket yet. Every candidate bulk
    // source was rejected (see utilities.ts for the evaluation), so the file
    // has to be converted from the state territory shapefile and uploaded.
    // Until then the toggle self-disables — the overlay controller reports the
    // missing archive rather than adding an empty layer that silently renders
    // nothing. Nothing else needs to change when it lands.
    id: 'coop-territories',
    group: 'climate',
    toggleId: 'mf-toggle-coop',
    apiKey: 'showCoopTerritories',
    label: 'Electric Co-op & Utility Territories',
    description: 'Whose ratepayers absorb the grid upgrade a site triggers.',
    fileName: 'Electric_Service_Territories_MN.pmtiles',
    hex: '#f59e0b',
    fillOpacity: 0.22,
    outlineHex: '#b45309',
    // Deliberately unset: the archive doesn't exist yet, so there is no
    // publisher to credit. Crediting a source we haven't actually used would
    // be the same failure as inventing a utility attribution. Set this from
    // the real dataset's terms at the same time the file is uploaded — the
    // dev warning in overlayLayers.ts is there to catch a miss.
  },
];

/**
 * Public R2 bucket holding the PMTiles archives.
 *
 * PERFORMANCE NOTE, measured against the live bucket rather than assumed.
 *
 * WHAT IS TRUE: the archives now carry `public, max-age=86400`, set as object
 * metadata by scripts/set-tile-cache-headers.ts. A measured reload served 7 of
 * 8 tile requests from the browser cache. Within a session MapLibre's own tile
 * cache covers it, which is why layers are hidden rather than torn down — see
 * overlayLayers.ts.
 *
 * WHAT IS NOT TRUE, and used to be implied here: that a visit costs 21 MB.
 * PMTiles is a range-request format and the client only ever asks for slices —
 * a header, a directory, and the tiles for the current viewport. A measured
 * session at statewide zoom with two layers switched on made 13 requests, all
 * of them `Range`, none of them the whole file. The archive is 20.4 MB; a
 * session is a tiny fraction of it.
 *
 * DO NOT "FIX" THIS WITH A WORKER PROXY, which is what this note used to
 * suggest. Routing tiles through a Worker to attach cache headers would turn
 * every one of those range requests into a Worker invocation — on a plan whose
 * request count is the binding limit long before bandwidth is. It trades a
 * caching problem for a quota problem, and the quota one is worse.
 *
 * The fix was on the bucket, not in this repo, and it has been applied twice
 * over: `Cache-Control` as object metadata, and this custom domain. `max-age`
 * is deliberately moderate rather than `immutable` — these filenames are stable
 * across re-uploads, so `immutable` would hide a re-tiled archive from
 * returning visitors for as long as it was set.
 *
 * STILL OPEN: the edge itself is not caching. `cf-cache-status` on this host
 * reads DYNAMIC, because `.pmtiles` is not in Cloudflare's default-cacheable
 * extension list, so every range request still reaches R2. The `max-age` above
 * is what browsers honour; a Cache Rule on the zone is what would make the edge
 * honour it too. That is a dashboard change, not a code change, and until it
 * exists this host buys HTTP/2 and a stable name rather than fewer origin hits.
 *
 * The other half is upstream of the client entirely: PAD-US was built with
 * `--no-tile-size-limit`, so its z5–z7 tiles are 0.5–1.5 MB each — a second or
 * more of parsing per tile no matter how well this code schedules it.
 * Re-running tippecanoe without that flag is the fix, and it is the single
 * biggest one available to this layer.
 */
// R2 custom domain on the zone we own, attached 2026-07-31. The bucket's
// `pub-9f0c29be…r2.dev` host is still enabled, so reverting is this one line.
const TILE_BASE_URL = 'https://tiles.mndatacenter.org';

/** Absolute URL of a layer's PMTiles archive. */
export const tileUrlFor = (layer: MapLayerMeta): string =>
  `${TILE_BASE_URL}/${layer.fileName}`;

/** MapLibre source id for a layer. */
export const sourceIdFor = (id: string): string => `${id}-source`;
/** MapLibre layer id for a layer's fill. */
export const layerIdFor = (id: string): string => `${id}-layer`;
/** MapLibre layer id for a layer's per-polygon border, when it declares one. */
export const outlineLayerIdFor = (id: string): string => `${id}-outline`;

/** A layer's fill colour for the given basemap darkness. See `darkHex`. */
export const fillColorFor = (layer: MapLayerMeta, dark: boolean): string =>
  (dark ? layer.darkHex : undefined) ?? layer.hex;

/** A layer's outline colour for the given basemap darkness. See `darkOutlineHex`. */
export const outlineColorFor = (layer: MapLayerMeta, dark: boolean): string =>
  (dark ? layer.darkOutlineHex : undefined) ?? layer.outlineHex;

/**
 * The overlays in one sidebar section that get their own row, in registry
 * order. Excludes `manualToggle` layers — folded into another control, so a
 * row here would be a second way to switch on something already reachable,
 * unchecked and silently doing nothing until its companion toggle is found.
 */
export const layersInGroup = (group: MapLayerGroup): MapLayerMeta[] =>
  MAP_LAYER_META.filter((layer) => layer.group === group && !layer.manualToggle);

/**
 * The registry keyed by id, for the two callers that hold an id and want the
 * layer: the overlay controller resolving a toggle, and the protected-lands card
 * reading that layer's own colours so a card matches the shape under it.
 */
export const MAP_LAYER_BY_ID = indexBy(
  MAP_LAYER_META,
  (layer) => layer.id,
  (layer) => layer,
);

/** Fired on `document` when a layer's archive can't be read. */
export const LAYER_UNAVAILABLE_EVENT = 'maplayerunavailable';

/**
 * Fired on `document` the first time a sidebar section containing layer toggles
 * is opened.
 *
 * It exists so reading the archives can wait for someone to go looking for a
 * layer. Warming them on page load cost every visitor seven range requests to
 * the tile bucket — measured — including the large majority who never open the
 * Climate or Politics sections at all. Deferring it to this event keeps both
 * things warming bought (a first toggle with nothing to wait for, and a missing
 * archive disabling its own row before it is clicked) because both happen while
 * the reader is still looking at the open section.
 */
export const LAYER_SECTION_OPEN_EVENT = 'maplayersectionopen';

/**
 * Why a layer isn't available. Two different sentences for the visitor: an
 * archive we haven't uploaded yet is a gap in the map, while one we failed to
 * read is a fault they might get past by retrying. Reporting the second as the
 * first would be telling them a dataset doesn't exist when it does.
 */
export type LayerUnavailableReason = 'missing' | 'unreadable';

export interface LayerUnavailableDetail {
  /** `MapLayerMeta.id` of the layer that failed to load. */
  id: string;
  reason: LayerUnavailableReason;
}
