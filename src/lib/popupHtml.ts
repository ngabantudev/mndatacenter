// src/lib/popupHtml.ts
//
// The two primitives every record card on the map is built from: escaping, and
// a titled block that disappears when there is nothing sourced to put in it.
//
// Both were written for `~/lib/moratoriumLayer.ts` and then wanted verbatim by
// the protected-lands card, which is the moment to name them once rather than
// keep a second copy in step.
//
// Popups only, which is why this isn't merged with `section()` in
// `~/lib/mapMarkers.ts`. A popup floats over the basemap and is deliberately
// white in both themes (see global.css), so its ink is fixed neutrals; the
// detail drawer sits in the app chrome and uses theme tokens. Same shape, two
// different surfaces, and a shared helper would have to know which.

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Third-party-safe by default.
 *
 * Two kinds of text end up in these cards and neither is ours to trust as
 * markup: hand-sourced registry prose, where a stray angle bracket in an
 * ordinance summary should render as one, and attribute values parsed out of a
 * public GIS export, which is third-party data being put on the page.
 */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]!);

/**
 * A labelled block, omitted entirely when there is nothing to put in it — so a
 * card renders the facts that were actually sourced and stays silent about the
 * rest, rather than showing a heading over an empty line.
 */
export const popupBlock = (title: string, body: string | null): string =>
  body
    ? `
      <div class="mt-2 pt-2 border-t border-neutral-100">
        <span class="block text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-1">${escapeHtml(title)}</span>
        ${body}
      </div>
    `
    : '';

/**
 * A small colored status pill — a dot plus a label, tinted by one hex. This
 * is the third primitive both `moratoriumLayer.ts`'s `postureChip` and
 * `facilityMarkers.ts`'s `badgeHtml` independently built by hand, byte-for-
 * byte identical down to the `1f` alpha suffix, before either called into
 * `popupHtml.ts` for it — named here for the same reason `escapeHtml` and
 * `popupBlock` already are. Found in review.
 */
export const chipHtml = (hex: string, label: string): string => `
    <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style="background-color: ${hex}1f; color: ${hex}">
      <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${hex}"></span>
      ${escapeHtml(label)}
    </span>
  `;
