// src/lib/pollutionScaleClient.ts
//
// The one message between the two surfaces of the pollution scale panel: a
// rail-footer trigger (in MapFilterParent.astro) and the modal it opens
// (PollutionScaleTracker.astro). Same shape as OPEN_CLEAN_GRID_EVENT in
// ~/lib/cleanGridClient.ts, and for the same reason — the trigger and the
// dialog are separate components mounted as siblings, and `showModal()` is
// the dialog's own business. See that file's note before changing this one.

/** Dispatched on `document` when the reader asks to see the full comparison. */
export const OPEN_POLLUTION_SCALE_EVENT = 'openpollutionscaletracker';
