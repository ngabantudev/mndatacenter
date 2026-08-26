// src/lib/newsMirror.ts
//
// The headline mirror: what CI fetched from Google News, for the Worker to read
// when Google will not answer the Worker itself.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS — measured, not assumed.
// ---------------------------------------------------------------------------
// Google refuses this Worker's egress. Same URL, same headers, same minute,
// three different source IPs:
//
//     residential            200, 45 items
//     GitHub Actions runner  200, 22 items
//     Cloudflare Worker      503
//
// It is not the query (both geography queries return 200 from a good IP), not
// the User-Agent (200 with the Chrome UA, with a default one, and with none),
// and not timing. The only variable that changes the answer is where the
// request comes from, and nothing in this repo can change that: Workers
// subrequests egress from Cloudflare's ranges.
//
// So the fix is not in the Worker. It is to fetch from somewhere Google does
// answer — CI, which the build-time snapshot already proves works — and leave
// the result somewhere the Worker can read. That is this key.
//
// ---------------------------------------------------------------------------
// WHY A SEPARATE KEY, RATHER THAN WRITING THE CACHE ENTRY DIRECTLY.
// ---------------------------------------------------------------------------
// The obvious shortcut is for CI to write `news:v3:<n>d` — the key `withCache`
// already serves from — and have the Worker pick it up for free. That does not
// work, and the reason is the layering in ~/lib/edgeCache.ts:
//
//     read() = module memory -> the colo's Cache API -> KV
//
// KV is the *last* layer consulted, and the Cache API entry is written with
// `max-age: keepSeconds`, which for news is seven days. So any colo that has
// served this key once holds an envelope for a week and never looks at KV
// again — CI's updates would be invisible to exactly the colos with traffic.
//
// A separate key avoids that entirely by changing what CI *is*. It is not a
// cache layer to be raced against; it is an upstream, read by the route's
// `build()` like any other source. `withCache`'s layering is untouched.
//
// ---------------------------------------------------------------------------
// AND WHY IT EXPIRES.
// ---------------------------------------------------------------------------
// `NEWS_MIRROR_TTL_SECONDS` is the whole staleness policy, and it is deliberate
// that there is no freshness field inside the value. If the refresh workflow
// stops — disabled, credentials rotated, Actions outage — these keys age out on
// their own and the route falls back to trying Google live, failing, and
// telling the reader so. A mirror that lingered would let a dead pipeline serve
// last week's headlines under no banner at all, which is the failure this
// project's whole news path is built to avoid.

// ---------------------------------------------------------------------------
// THIS MODULE MUST STAY FREE OF WORKER-ONLY IMPORTS.
// ---------------------------------------------------------------------------
// `scripts/refresh-news.ts` imports it from plain Node in CI, so anything that
// reaches `cloudflare:workers` — directly or through ~/lib/edgeCache.ts —
// breaks that runner with ERR_UNSUPPORTED_ESM_URL_SCHEME. Same split, and the
// same reason, as ~/lib/legislation.ts (shapes, importable anywhere) against
// ~/lib/openStates.ts (bindings, pages/api only).
//
// That is why the KV read itself is NOT here: it needs the binding, so it lives
// in ~/pages/api/news.ts, which is Worker-only already. What lives here is
// everything both sides have to agree on — the key, the windows, the TTL, and
// what a valid stored value looks like.

import type { NewsItem } from "./newsFeed";

/**
 * One window's mirror.
 *
 * Deliberately the same three fields the route caches, plus the one thing KV
 * cannot infer: when CI actually fetched it. `truncated` and `partial` travel
 * with the items because they describe *that* fetch — recomputing them Worker
 * side, or defaulting them to false, would tell the reader a period is fully
 * covered when the fetch that produced it said otherwise.
 */
export interface NewsMirror {
  items: NewsItem[];
  truncated: boolean;
  partial: boolean;
  /** ISO time CI fetched this from Google. Not when the Worker read it. */
  fetchedAt: string;
}

/**
 * Windows mirrored, matching ALLOWED_WINDOWS in ~/pages/api/news.ts.
 *
 * Exported so the refresh script iterates the same list the route serves rather
 * than carrying its own copy — a window mirrored but never requested is wasted
 * KV writes, and one requested but never mirrored is a silent hole.
 */
export const MIRRORED_WINDOWS = [1, 7, 30, 365] as const;

/**
 * How long a mirror survives without being rewritten.
 *
 * Two hours against a half-hourly refresh: enough slack for GitHub's scheduled
 * runs, which are routinely late by ten minutes or more under load, and short
 * enough that a pipeline which has genuinely stopped stops being believed
 * within one news cycle.
 */
export const NEWS_MIRROR_TTL_SECONDS = 7200;

/** KV key for one window. Versioned like the cache key, for the same reason:
 *  a shape change must not be read back by code expecting the old one. */
export function newsMirrorKey(windowDays: number): string {
  return `news:mirror:v1:${windowDays}d`;
}

/**
 * Parse a stored mirror, or null if it isn't one we can use.
 *
 * Exported because the read lives in ~/pages/api/news.ts — see the note at the
 * top of this file on why — and the *validation* belongs next to the shape it
 * validates rather than at the call site.
 */
export function parseNewsMirror(raw: string): NewsMirror | null {
  try {
    const parsed = JSON.parse(raw) as Partial<NewsMirror>;
    // Structural, not a cast. This value is written by a *different process* on
    // a different schedule, so it is the one input here that can legitimately
    // be from an older shape.
    if (!Array.isArray(parsed?.items) || typeof parsed?.fetchedAt !== "string") {
      return null;
    }
    return {
      items: parsed.items,
      truncated: parsed.truncated === true,
      partial: parsed.partial === true,
      fetchedAt: parsed.fetchedAt,
    };
  } catch {
    return null;
  }
}
