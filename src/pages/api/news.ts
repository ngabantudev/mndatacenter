// src/pages/api/news.ts
//
// Runs on-demand (per request) rather than being built as a static file.
// Requires `output: 'server'` plus the @astrojs/cloudflare adapter in
// astro.config.mjs — this route is excluded from static prerendering
// via `export const prerender = false` below.
//
// This route is now the source of truth for the news panel, which it wasn't
// before: the panel rendered a snapshot baked in at build time and only called
// this when someone clicked a date range. That's why there was a cron job
// rebuilding the entire site every six hours just to refresh headlines.
//
// Being the source of truth means being reliable, and it wasn't — measured on a
// live deployment, roughly one request in three returned nothing, because a 2s
// fetch budget with no cache behind it meant every visitor paid a fresh Google
// round trip and the slow ones lost. The budget is now 8s (see
// ~/lib/newsFeed.ts) and the result goes through the same cache as the
// legislative tracker: one fetch per window per freshness period shared by every
// visitor, single-flighted, with the last good result served when Google can't
// be reached.

import type { APIRoute } from "astro";
import { kvNamespace, withCache } from "~/lib/edgeCache";
import { jsonResponse } from "~/lib/jsonResponse";
import { withResponseCache } from "~/lib/responseCache";
import { fetchNews, type NewsItem, type NewsPayload } from "~/lib/newsFeed";
import { newsMirrorKey, parseNewsMirror, type NewsMirror } from "~/lib/newsMirror";

export const prerender = false;

/**
 * The mirror CI writes for one window, or null if there isn't a usable one.
 *
 * Lives here rather than beside the rest of the mirror contract in
 * ~/lib/newsMirror.ts for one reason: it needs the KV binding, and that module
 * is imported by `scripts/refresh-news.ts` from plain Node, where anything
 * reaching `cloudflare:workers` fails to resolve. So the shape, the key and the
 * validation are shared; the binding stays on this side of the line.
 *
 * Null covers every reason equally — no binding, no key, expired, unparseable —
 * because the caller does the same thing in all of them: fall through to a live
 * fetch and, failing that, say so.
 */
async function readNewsMirror(windowDays: number): Promise<NewsMirror | null> {
  const store = kvNamespace();
  if (!store) return null;

  const raw = await store
    .get(newsMirrorKey(windowDays), "text")
    .catch(() => null);
  return raw ? parseNewsMirror(raw) : null;
}

/** What one window's cache entry holds. The truncation flag is cached with the
 *  items because it describes that same fetch — recomputing it later, or
 *  defaulting it to false when serving a stale copy, would tell the reader the
 *  period is fully covered when the fetch that produced it said otherwise. */
interface CachedNews {
  items: NewsItem[];
  truncated: boolean;
  partial: boolean;
  /**
   * When these items were fetched from Google, ISO — set only when they came
   * from the CI mirror rather than from this Worker.
   *
   * Optional, and read with a default below rather than behind a key bump, for
   * the reason the note on `toPayload` gives about `partial`. Its whole job is
   * honesty about age: `withCache` stamps `storedAt` when *its* build
   * succeeded, and for a mirror read that is when the Worker read KV, not when
   * the headlines were fetched. Serving the first as the second would date the
   * news up to a refresh interval fresher than it is.
   */
  fetchedAt?: string;
}

/**
 * Read a cache entry back into the payload's shape, tolerating one written by
 * an older deploy.
 *
 * Entries outlive the code that wrote them by up to KEEP_SECONDS — a week — and
 * the version in the key is the intended guard against reading them as the
 * wrong shape. It only works if every shape change remembers to bump it, and
 * `partial` was added to this interface without one: entries from before it
 * came back with the field simply absent, which `JSON.stringify` then dropped
 * from the response, so the client saw no `partial` key at all rather than
 * `false`. It reads that as falsy and quietly stops mentioning that a window
 * lost some of its searches.
 *
 * Defaulting here fixes the class rather than the instance. Bumping the version
 * would fix this one and cost more than it's worth right now — it discards
 * every last-good copy at exactly the moment Google is refusing us, which is
 * when those copies are the only thing the panel has to show.
 */
function toPayload(
  cached: CachedNews,
  meta: { stale: boolean; storedAt: string },
): NewsPayload {
  return {
    newsItems: cached.items ?? [],
    errorMessage: null,
    truncated: cached.truncated ?? false,
    partial: cached.partial ?? false,
    stale: meta.stale,
    // CI's fetch time wins when there is one — see `fetchedAt` above.
    storedAt: cached.fetchedAt ?? meta.storedAt,
  };
}

const ALLOWED_WINDOWS = [1, 7, 30, 365]; // days — beyond 1y rarely changes
                                          // results given Google News RSS's
                                          // ~100-item cap, so we stop here.

/**
 * Freshness per window, in seconds.
 *
 * A 24-hour window turns over fast and is what someone checks for breaking
 * news, so it's the tightest. A year of coverage doesn't change meaningfully
 * inside an hour. These are the numbers that decide how often Google is asked
 * at all: at worst one call per window per period, whatever the traffic.
 */
const FRESH_SECONDS: Record<number, number> = {
  1: 900, // 15 min
  7: 1800, // 30 min
  30: 3600, // 1 h
  365: 21600, // 6 h
};

/** Kept far longer than it stays fresh, purely as an outage fallback.
 *  Yesterday's headlines beat an empty panel, and every item shows its date. */
const KEEP_SECONDS = 604800; // 7 days

/**
 * Freshness for a window that only came back in part.
 *
 * `fetchNews` reports success when at least one of a window's searches
 * answered, which is right — a year fetched as ten searches shouldn't be thrown
 * away because one of them dropped its connection. But the result was then
 * cached as though it were whole, so a single bad moment during a 1Y refresh
 * defined that window for the next six hours, and could overwrite a complete
 * copy with a thinner one having done so.
 *
 * Five minutes is long enough to keep a flapping upstream from being re-asked
 * per request, and short enough that the gap is filled by the next reader
 * rather than by the next deploy. The result is still served and still labelled
 * `partial` in the payload — this governs only how long we decline to improve
 * on it.
 */
const PARTIAL_FRESH_SECONDS = 300;

/**
 * How long to leave Google alone after a failed refresh.
 *
 * This was 10s, on the reasoning that Google News RSS enforces no per-minute
 * quota and its failures are dropped connections, so a long backoff would turn
 * one blip into a minute of empty panel.
 *
 * The first half of that is still true and the conclusion no longer follows,
 * because the blip case is now handled a layer down: `fetchOneQuery` retries a
 * dropped connection immediately, within one request. Nothing is left for a
 * short backoff here to rescue — by the time a failure reaches this level it
 * has already survived a retry, which makes it an outage rather than a blip.
 *
 * And an outage is what 10s handled badly. Google does refuse this Worker's
 * egress for long stretches — 503, sustained, reproducible — and at 10s each
 * window re-probed roughly six times a minute, indefinitely, with whoever
 * arrived mid-probe waiting on it. A minute costs a returning reader nothing
 * (the tightest window is only fresh for 15) and cuts that by six.
 */
const FAILURE_BACKOFF_SECONDS = 60;

export const GET: APIRoute = async ({ request, url }) => {
  // Wrapped so a colo answers repeat requests for the same window without
  // re-running any of this — see ~/lib/responseCache.ts. The freshness is the
  // `s-maxage` computed at the bottom of this function; there is no second TTL.
  return withResponseCache(request, () => buildNewsResponse(url));
};

async function buildNewsResponse(url: URL): Promise<Response> {
  const requested = Number(url.searchParams.get("days"));
  const windowDays = ALLOWED_WINDOWS.includes(requested) ? requested : 7;
  const freshSeconds = FRESH_SECONDS[windowDays] ?? 1800;

  // Captured from inside the builder so the reader gets the actual reason —
  // a timeout, or Google's status code — instead of one generic sentence that
  // covers up which of the two happened.
  let failure: string | null = null;

  const result = await withCache<CachedNews>(
    // Bump this version whenever the query, the relevance filter, or the shape
    // cached here changes. Entries outlive a deploy by design — KEEP_SECONDS is
    // a week — so without a bump the new code serves the old code's results
    // until they age out, and a changed shape would be read back as the wrong
    // type entirely.
    //
    // It also matters for review: the cache key contains no deployment
    // identity, so a PR preview and production address the same entries. Both
    // returned an identical 19 and 26 here while the branch's own numbers were
    // 29 and 49, which reads as a change that did nothing rather than a change
    // that hadn't been reached yet.
    `news:v3:${windowDays}d`,
    {
      // A window that lost some of its searches is re-attempted sooner, so a
      // thin copy can't hold the slot a complete one should occupy.
      freshSeconds: (value) =>
        value.partial === true
          ? Math.min(PARTIAL_FRESH_SECONDS, freshSeconds)
          : freshSeconds,
      keepSeconds: KEEP_SECONDS,
      failureBackoffSeconds: FAILURE_BACKOFF_SECONDS,
    },
    async () => {
      // THE MIRROR IS TRIED FIRST, and that ordering is the point rather than
      // an optimisation. Google refuses this Worker's egress outright — see the
      // measurements in ~/lib/newsMirror.ts — so a live attempt here is not the
      // fast path, it is an 8-second timeout in front of the answer. Reaching
      // for KV first costs tens of milliseconds and usually ends the work.
      //
      // Falling *through* to the live fetch is what keeps this honest in both
      // directions: if the refresh workflow stops, its keys expire within two
      // hours and this route goes straight back to asking Google itself, fails,
      // and tells the reader — rather than a dead pipeline quietly serving last
      // week under no banner. And if Google ever starts answering Workers
      // again, deleting the workflow is the only change needed.
      const mirrored = await readNewsMirror(windowDays);
      if (mirrored) {
        return {
          items: mirrored.items,
          truncated: mirrored.truncated,
          partial: mirrored.partial,
          fetchedAt: mirrored.fetchedAt,
        };
      }

      const fetched = await fetchNews(windowDays);
      if (fetched.ok) {
        return {
          items: fetched.newsItems,
          truncated: fetched.truncated,
          partial: fetched.partial,
        };
      }
      // Only a real failure returns null. An empty-but-successful fetch is a
      // fact about a quiet week and gets cached as one — otherwise a quiet week
      // would refetch on every request and, worse, keep serving last month's
      // articles as though they were this week's.
      failure = fetched.reason;
      return null;
    },
  );

  const payload: NewsPayload = result
    ? toPayload(result.value, { stale: result.stale, storedAt: result.storedAt })
    : {
        newsItems: [],
        // `failure` is null when the backoff short-circuited before any fetch,
        // so say that rather than implying we just tried and Google refused.
        errorMessage: failure ?? "News feed temporarily unavailable.",
        truncated: false,
        partial: false,
        stale: false,
        storedAt: null,
      };

  // Client max-age stays short so a reader with a tab open picks up new
  // coverage. s-maxage is what would matter behind a zone cache and is
  // harmless where there isn't one.
  const maxAge = windowDays >= 365 ? 3600 : 120;
  // Mirrors the freshness actually stored above. Advertising the full window
  // for a stale or partial answer would have any shared cache in front of us
  // hold the degraded copy exactly as long as a complete one — the same bug as
  // the entry itself, one layer out.
  const sMaxAge = result?.stale
    ? 60
    : payload.partial
      ? Math.min(PARTIAL_FRESH_SECONDS, freshSeconds)
      : freshSeconds;

  return jsonResponse(payload, {
    maxAge,
    sMaxAge,
    headers: {
      // Lets us tell "live" from "last known good" when debugging, without
      // changing the payload shape the client already parses.
      // Derived from the value, not from whether `build()` happened to run on
      // this request. `fetchedAt` is set only by the mirror branch, so it stays
      // correct for a cached copy too — an entry that came from KV an hour ago
      // is still a mirror answer, and a flag set inside the builder would have
      // reported it as "live" on every request that hit the cache, which is
      // most of them.
      "X-News-Source": result
        ? result.stale
          ? "stale"
          : result.value.fetchedAt
            ? "mirror"
            : "live"
        : "unavailable",
    },
  });
}
