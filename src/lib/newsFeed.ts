// src/lib/newsFeed.ts
import { decodeEntities } from './htmlEntities';

export interface NewsItem {
  title: string;
  url: string;
  published: string;
  source: string;
}

/**
 * Deliberately distinguishes "the fetch failed" from "the fetch worked and
 * matched nothing".
 *
 * That distinction is load-bearing now that ~/pages/api/news.ts caches this and
 * falls back to the last good result. Collapsing both into an empty array would
 * make a genuinely quiet news day look identical to a failed request — and the
 * cache would either overwrite good results with an outage's emptiness, or
 * serve last week's articles on a day that really had none. Neither is true.
 */
export type NewsResult =
  | { ok: true; newsItems: NewsItem[]; truncated: boolean; partial: boolean }
  | {
      ok: false;
      reason: string;
      /**
       * Whether trying the identical request again could plausibly answer
       * differently. See `fetchOneQuery` — this is what stops a refusal from
       * being paid for twice.
       */
      retryable: boolean;
    };

/**
 * The flattened shape the UI consumes, and the JSON body of /api/news.
 *
 * Declared here rather than in the route so the route, the server-rendered
 * first paint, and the client island that parses the response all agree by
 * construction — all three previously re-declared the same two fields inline.
 */
export interface NewsPayload {
  newsItems: NewsItem[];
  errorMessage: string | null;
  /**
   * True when Google returned all it will return for at least one of the
   * searches behind this window, so the list is a sample of the period rather
   * than a record of it. Surfaced in the panel — a civic feed that quietly
   * truncates a year reads as "this is what happened", which is a claim we
   * cannot support.
   */
  truncated: boolean;
  /**
   * True when at least one of the searches behind this window failed while
   * others succeeded.
   *
   * Distinct from `truncated`, and worth its own flag rather than being folded
   * in: a long window is fetched as several date ranges, so one dropped
   * connection silently removes a specific stretch of the period rather than
   * thinning the list evenly. Without this, a year missing three of its five
   * segments looks exactly like a year in which little happened.
   */
  partial: boolean;
  /**
   * True when the live refresh failed and these items are the last good copy.
   *
   * The route has always known this — it sets an `X-News-Source` header for
   * debugging — but the panel never did, so during an outage a reader saw
   * headlines fetched hours ago with nothing to distinguish them from live
   * ones. A civic feed that serves yesterday as today is making a claim about
   * the world it can't support.
   */
  stale: boolean;
  /**
   * When these items were fetched, ISO. Null when there is nothing to date —
   * an outage with no cached copy behind it.
   *
   * Paired with `stale` rather than folded into it: "these are cached" and
   * "cached *when*" are separate facts, and the second is what decides whether
   * a reader should trust the list or go and look elsewhere.
   */
  storedAt: string | null;
}

/**
 * Most items Google News RSS will return for one search, whatever is asked.
 *
 * Measured, not documented: `"data center" when:365d`, a bare `data center`,
 * and even `news when:365d` all come back with exactly 100. A search returning
 * exactly this many has almost certainly been cut off rather than exhausted.
 */
const GOOGLE_RESULT_CEILING = 100;

/**
 * Wall-clock budget for one query — *including* its retry, not per attempt.
 *
 * Was 2000ms, which failed roughly one request in three from a Worker —
 * measured across all four windows on a live deployment. Google itself answers
 * in 0.2-0.6s, so the old budget wasn't wrong about Google being fast; it was
 * too tight to absorb a cold isolate and a TLS handshake on top. There is no
 * cost to waiting longer on the rare slow call: the result is cached, so the
 * next visitor doesn't wait at all.
 *
 * "Including its retry" is the part that was wrong until now. Each attempt got
 * its own 8s, so a window where Google was simply not answering cost 16s before
 * anyone was told — measured at 13-16s per request against the live deployment
 * while Google was 503ing the Worker's egress. The budget is the promise to the
 * caller, so the retry has to spend what's left of it rather than opening a
 * second one.
 */
const QUERY_BUDGET_MS = 8000;

/**
 * Least time worth starting a second attempt with.
 *
 * Under this, a retry can only turn one timeout into two and report the later
 * one. The retry exists for connections that drop in milliseconds, and those
 * leave nearly the whole budget behind — so the cases it was written for all
 * clear this comfortably, and the case it was accidentally doubling does not.
 */
const MIN_RETRY_BUDGET_MS = 1500;

/**
 * Newest first. Written out twice before — here and again in the news rail's
 * client script, which re-sorts after fetching a different date range — so the
 * two paths could have disagreed about ordering.
 */
export function byPublishedDesc(
  a: { published: string },
  b: { published: string },
): number {
  return new Date(b.published).getTime() - new Date(a.published).getTime();
}

/**
 * How a headline's date is written, in one place. The rail renders items from
 * two paths — the build-time snapshot through the Astro template, and the
 * client's own fetch when someone picks another range — and each had its own
 * copy of these options, ~130 lines apart in the same file.
 *
 * `undefined` locale on purpose: the reader's own, not ours.
 */
export function formatNewsDate(published: string): string {
  return new Date(published).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * How long ago a cached copy was fetched, for the degraded banner.
 *
 * Coarse on purpose. The number exists to answer "should I trust this list",
 * and "saved 3 hours ago" answers that where "saved 2h 47m ago" only looks
 * like it does — the underlying `storedAt` is the moment a cache entry was
 * written, not the moment the news happened, and precision would suggest we
 * know more about the gap than we do.
 *
 * Returns null for anything unparseable rather than a fallback string, so the
 * caller drops the phrase instead of rendering "saved NaN ago".
 */
export function formatCacheAge(storedAt: string | null, now: number = Date.now()): string | null {
  if (!storedAt) return null;
  const then = new Date(storedAt).getTime();
  if (!Number.isFinite(then)) return null;

  const minutes = Math.floor((now - then) / 60_000);
  // Clock skew between the edge that wrote the entry and the reader's own
  // machine can make a fresh copy look like it arrives from the future.
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// --- Tune these lists to control precision without touching the fetch/parse logic ---

// Must match at least one of these — establishes it's actually about a data center.
const DATA_CENTER_TERMS = ["data center", "data centre", "hyperscale", "server farm"];

/**
 * Twin Cities metro counties, matched as "<name> county" phrases rather than
 * bare county names — "Dakota" alone pulls in every North and South Dakota
 * story, which is a large share of the country's data center news.
 *
 * Five of the seven metro counties are here. Washington and Scott are left out
 * on purpose, and the omission is measured rather than assumed: over a 30-day
 * window, `"data center" "Washington County"` returned 57 stories and not one
 * of them was Minnesota's — Hillsboro and Washington County, Oregon are one of
 * the largest data center clusters in the country, and Maryland and Alabama
 * supplied most of the rest. `"Scott County"` returned 33, of which exactly one
 * was Minnesota; the rest were Kentucky and Iowa. Admitting either name would
 * put other states' data center fights on a Minnesota map. Both counties are
 * covered below by their city names instead, which don't collide.
 */
const METRO_COUNTY_TERMS = [
  "anoka county",
  "carver county",
  "dakota county",
  "hennepin county",
  "ramsey county",
];

/**
 * Counties outside the seven that carry real data center proceedings anyway.
 *
 * Sherburne is where Becker and Elk River are, and the name is Minnesota's
 * alone — a 365-day check returned 13 data center stories under it and every
 * one was this state's.
 *
 * Wright County is the conspicuous omission, and it is a close call rather than
 * an obvious one: 21 stories over the same year, roughly four in five of them
 * Minnesota's, since the Monticello proposals and the county's emergency
 * moratorium are among the largest data center fights in the state right now.
 * The remainder are Wright County, Iowa, which is running its own data center
 * moratorium under a phrase we cannot tell apart. Admitting one in five Iowa
 * stories to catch Minnesota ones we already reach through Monticello, Otsego,
 * Albertville and St. Michael below — and through the local outlets covering
 * them — is a bad trade, so the towns carry it.
 */
const EXURBAN_COUNTY_TERMS = ["sherburne county"];

/**
 * Minnesota news outlets, matched against an item's `<source>`.
 *
 * The place-name list below can only see the headline and Google's one-line
 * description, so it misses any story that names a town in its body and not its
 * title — which is most of them. Measured over 30 days, the place list alone
 * dropped 25 data center stories that Google had already matched to Minnesota,
 * including the Pine Island fight, three separate Elk River council votes, the
 * Monticello application, Otsego's pause, and both Mankato moratoriums.
 *
 * The outlet is the signal that recovers those: a data center story filed by
 * the Star Tribune or hometownsource is Minnesota coverage by construction.
 * The trade is that a Minnesota paper's wire story about somebody else's data
 * center now passes too — MinnPost on rural America, say. For a Minnesota data
 * center watch that reads as coverage worth showing, and it is a far smaller
 * error than silently dropping half the state's local reporting.
 */
const MINNESOTA_SOURCE_TERMS = [
  "star tribune",
  "minnpost",
  "pioneer press",
  "hometownsource",
  "southernminn",
  "post bulletin",
  "west central tribune",
  "bring me the news",
  "5 eyewitness news", // KSTP
  "kare11",
  "kare 11",
  "wcco",
  "fox 9",
  // Small-market stations doing the closest reporting on the exurban fights —
  // KRWC is Buffalo, KYMN is Northfield, KEYC is Mankato. These are how a
  // Wright County story reaches us now that the county name doesn't.
  "krwc",
  "kymn",
  "keyc",
  "patriot news mn",
  "mpr news",
  "minnesota public radio",
  "sahan journal",
  "minnesota reformer",
  "finance & commerce",
  "duluth news tribune",
  "mankato free press",
  "brainerd dispatch",
  "st. cloud live",
  "alpha news",
  "minnesota women's press",
];

/**
 * The check that keeps the outlet signal honest.
 *
 * Trusting the source alone let Pioneer Press wire copy through — "Virginia
 * study on groundwater, data centers calls for tighter water regulations" and
 * "New York won't build big data centers for a year" both landed in the feed.
 * A Minnesota paper reprinting somebody else's data center news is not
 * Minnesota data center news, and putting it on this map misrepresents it.
 *
 * Applied only to items that matched on the outlet and named no Minnesota place
 * at all, so it can never override a headline that says Minneapolis or Anoka
 * County outright. That narrow application is what makes it safe to be blunt
 * about it: a story that names another state and nowhere here is the ambiguous
 * case, and dropping it is the better error.
 */
function isLocalOutlet(source: string): boolean {
  const name = source.toLowerCase();
  return MINNESOTA_SOURCE_TERMS.some((t) => name.includes(t));
}

/**
 * The second check on the outlet signal, for scope rather than place.
 *
 * The state guard below only catches copy that names somewhere else. It does
 * nothing about a Minnesota paper's coverage of the industry at large, which
 * is how "Five things to know as data centers spread across rural America" and
 * "Trump expands a voluntary pledge to protect consumers from high utility
 * bills from AI data centers" reached a map of Minnesota sites.
 *
 * Same narrow application as the state guard: only items resting entirely on
 * their outlet. A story that names a Minnesota place is unaffected however
 * national its framing, so the Star Tribune explaining a federal rule's effect
 * on Becker still belongs here and still arrives.
 */
const NATIONAL_SCOPE_PATTERN =
  /\b(rural america|across america|nationwide|across the country|the u\.?s\.?|united states|nationally|nation's|federal government|white house|congress|trump|globally|worldwide|every state|other states)\b/;

const OTHER_STATE_PATTERN = new RegExp(
  `\\b(${[
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
    "maryland", "massachusetts", "michigan", "mississippi", "missouri",
    "montana", "nebraska", "nevada", "new hampshire", "new jersey",
    // The Dakotas appear in their welded form because the haystack is
    // normalised before any of this runs — see the `north_dakota` replacement
    // where it's built.
    "new mexico", "new york", "north carolina", "north_dakota_state", "ohio",
    "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
    "south_dakota_state", "tennessee", "texas", "utah", "vermont", "virginia",
    "west virginia", "wisconsin", "wyoming",
  ].join("|")})\\b`,
);

// Must match at least one of these — establishes Minnesota relevance without
// depending on the literal word "Minnesota" appearing in the article.
const MINNESOTA_TERMS = [
  "minnesota",
  " mn ",
  "twin cities",
  ...METRO_COUNTY_TERMS,
  ...EXURBAN_COUNTY_TERMS,
  // Largest MN cities by population
  "minneapolis",
  "st. paul",
  "saint paul",
  "rochester",
  "duluth",
  "bloomington",
  "brooklyn park",
  "plymouth",
  "maple grove",
  "woodbury",
  "st. cloud",
  "saint cloud",
  "eagan",
  "eden prairie",
  "burnsville",
  "coon rapids",
  "blaine",
  "lakeville",
  "minnetonka",
  "apple valley",
  // Known/likely MN data-center hub cities
  "farmington",
  "becker",
  "shakopee",
  "rosemount",
  "chaska",
  "faribault",
  // Washington and Scott county seats and larger cities. These stand in for the
  // two county names held out above, and unlike those names they're Minnesota's
  // alone in practice.
  "stillwater",
  "cottage grove",
  "oakdale",
  "forest lake",
  "savage",
  "prior lake",
  // Remaining Anoka County population centers, which the metro list reached
  // only through Coon Rapids and Blaine.
  "anoka",
  "andover",
  "fridley",
  "champlin",
  // Towns with live data center proceedings that the 30-day measurement caught
  // this list dropping. Wright and Sherburne counties are the reason several of
  // these appear; the county names themselves are ambiguous — Wright County,
  // Iowa is running its own data center fight and files under the same phrase —
  // so the towns carry the geography instead.
  "monticello",
  "otsego",
  "elk river",
  "big lake",
  "albertville",
  "st. michael",
  "pine island",
  "lonsdale",
  "mankato",
  // Towns and counties that only reached the feed through their outlet, which
  // meant MPR's Hermantown and Inver Grove Heights coverage — two of the
  // largest fights in the state — rested on a signal meant as a backstop.
  "hermantown",
  "inver grove heights",
  "nobles county",
];

/**
 * The geography half of the query, as two separate searches rather than one.
 *
 * The county names have to be asked for somehow: gating on the bare token
 * `Minnesota`, as this did, means a story headlined "Anoka County board delays
 * data center vote" never comes back at all. Google News RSS does honour `OR`
 * inside parentheses — checked against the live feed, since the docs don't
 * specify it — so folding the counties into one widened query is the obvious
 * move, and it's wrong.
 *
 * It's wrong because the response is capped: measured at ~60 items for a 30-day
 * window and 100 for a year, whatever the query. Terms compete for one fixed
 * budget, so widening trades coverage rather than adding it. That isn't a
 * theory — with the counties folded in, "Google behind plans for Duluth area
 * data center" dropped out of every one of three samples, while the plain
 * Minnesota query returned it in all three. Displacing Duluth to reach Anoka is
 * not a trade worth making when both are cheap.
 *
 * Two queries get two budgets. The cost is one extra upstream call per window
 * per freshness period — 15 minutes at the tightest — which the cache in
 * ~/pages/api/news.ts absorbs entirely.
 */
const GEOGRAPHY_QUERIES = [
  // Byte-identical to the query this file has always sent, parentheses and all
  // — which is to say, none. That is not fussiness: the first attempt at this
  // widened it only as far as `(Minnesota OR "Twin Cities")`, and "Eagan facing
  // lawsuit over data center moratorium" then vanished from all three samples
  // when it had been present in all three before. Merely grouping the term
  // reorders what Google fits into the cap. Leaving this string untouched is
  // what makes the second search additive by construction rather than by
  // measurement.
  "Minnesota",
  `(${[
    '"Twin Cities"',
    ...[...METRO_COUNTY_TERMS, ...EXURBAN_COUNTY_TERMS].map(
      (county) => `"${county.replace(/\b\w/g, (c) => c.toUpperCase())}"`,
    ),
  ].join(" OR ")})`,
];

/**
 * Longest stretch asked for in one search.
 *
 * The ceiling above is per search, not per window, so a long window asked for
 * in one go loses whatever doesn't fit. Splitting it into consecutive date
 * ranges gives each stretch its own allowance: a year asked for once returned
 * 176 items across both searches, and asked for in quarters returned 612.
 *
 * Ninety days rather than something smaller because the gain flattens while the
 * cost doesn't. Sixty-one-day segments only reached 762, and every extra
 * segment is two more calls to an upstream that already drops connections from
 * a Worker — where a failure costs a whole quarter of the year, four segments
 * fail more gracefully than twelve. Minnesota's data center coverage is dense
 * enough that the most recent quarters still hit the ceiling even split this
 * way, which is exactly what `truncated` exists to admit rather than hide.
 */
const MAX_SEGMENT_DAYS = 90;

/**
 * The date half of the query, as one clause per stretch of the window.
 *
 * Returns a single `when:Nd` for anything inside a month, which is both what
 * Google documents and what it handles best. Longer windows become explicit
 * `after:/before:` ranges, since `when:` beyond ~1y is undocumented and its
 * behaviour isn't guaranteed.
 */
function buildDateQueries(windowDays: number): string[] {
  if (windowDays <= 30) {
    return [`when:${windowDays}d`];
  }

  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const now = new Date();
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - windowDays);

  // Even segments, rather than filling from the near end and leaving whatever
  // is left over: 365 days cut into 90s ends with a five-day tail that costs a
  // full pair of upstream calls to cover five days of news.
  const segments = Math.ceil(windowDays / MAX_SEGMENT_DAYS);
  const segmentDays = windowDays / segments;

  return Array.from({ length: segments }, (_, i) => {
    const before = new Date(now);
    before.setDate(before.getDate() - Math.round(i * segmentDays));
    const after = new Date(now);
    after.setDate(after.getDate() - Math.round((i + 1) * segmentDays));
    return `after:${fmt(after)} before:${fmt(before)}`;
  });
}

/**
 * Words carried by so much of this feed that counting them would make any two
 * headlines look alike, plus ordinary English filler. Removing them is what
 * makes the overlap below measure the story rather than the topic.
 */
const DUPLICATE_STOP_WORDS = new Set(
  ("a an the and or but of in on at to for with from by as is are was were be " +
    "been that this it its into over under after before more most new news say " +
    "says said will would can could what when where who why how than then them " +
    "they their there here about against during up down out off " +
    "data center centers centre minnesota mn").split(" "),
);

function contentWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !DUPLICATE_STOP_WORDS.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * How alike two headlines must be to count as the same story, and how close
 * together they must have run.
 *
 * Both numbers are deliberately conservative, because the two errors are not
 * equally bad: showing one story twice is untidy, and collapsing two different
 * stories into one hides local reporting from someone trying to follow a fight
 * in their own town. Only the second is a lie.
 *
 * 0.55 is the lowest setting at which every collapse over a year of this feed
 * was checked by hand and found to be a genuine repeat — nine of them, mostly
 * the same Google announcement rewritten by five outlets in a day. At 0.50 it
 * starts merging "Google seeks tax break for massive data center in Hermantown"
 * into "Hermantown delays vote on tax break for Google data center", which are
 * two different events a fortnight apart, so 0.50 is where it stops being true.
 *
 * There is a hard ceiling on what this can do, and it isn't worth pretending
 * otherwise: "Data center company acquires former Minnesota Star Tribune
 * printing site" and "Data center developer signs deal to buy Minnesota Star
 * Tribune's shuttered plant" are one story and score 0.18, while "Inver Grove
 * Heights approves one-year moratorium" and "Inver Grove Heights meeting erupts
 * into shouts after moratorium delayed" are two meetings and score 0.36. No
 * threshold separates those. This one collapses what is provably duplicate and
 * leaves the rest alone.
 *
 * Weighting rare words instead of counting them equally is the obvious next
 * idea and does not work — it was tried. Scoring by inverse document frequency
 * over the year's headlines moved "Google announces data center near Rochester"
 * against "Google set to build data center near Rochester", one story, from
 * 0.50 to 0.47, and "Google seeks tax break for massive data center in
 * Hermantown" against "Hermantown delays vote on tax break", two stories, from
 * 0.50 to 0.44. It compresses the gap rather than opening it. Separating those
 * needs the article, and RSS gives us a headline.
 *
 * The date window is what stops a recurring story from eating itself: the same
 * outlet's "Mpls City Council to vote on data center moratorium" and "Mpls City
 * Council discusses data center moratorium" score 0.67, and are twenty days and
 * two meetings apart.
 */
const DUPLICATE_OVERLAP = 0.55;
const DUPLICATE_WINDOW_DAYS = 7;

/**
 * Collapse syndicated and wire-copy repeats of one story.
 *
 * Keeps the Minnesota outlet's version when the cluster has one, on the
 * grounds that a reader following a local fight is better served by the paper
 * covering it than by the aggregator that reprinted it. Otherwise keeps the
 * first, which — the list arriving sorted — is the most recent.
 *
 * Exported because the rail has to run it a second time. Its client keeps a
 * pool of every article seen this session and renders a window by filtering
 * that pool, so collapsing each response on its own is not enough: two versions
 * of one story can arrive in two different responses and meet for the first
 * time in the pool. That is exactly what happened with the Star Tribune
 * printing plant sale, where the 7-day and 1-year fetches each carried a
 * different CBS headline for it.
 */
export function collapseDuplicates(items: NewsItem[]): NewsItem[] {
  const kept: { item: NewsItem; words: Set<string>; at: number }[] = [];

  for (const item of items) {
    const words = contentWords(item.title);
    const at = new Date(item.published).getTime();
    const twin = kept.find(
      (k) =>
        Math.abs(at - k.at) <= DUPLICATE_WINDOW_DAYS * 86_400_000 &&
        overlap(words, k.words) >= DUPLICATE_OVERLAP,
    );

    if (!twin) {
      kept.push({ item, words, at });
      continue;
    }

    // Same story. Prefer whichever version is the local one.
    if (isLocalOutlet(item.source) && !isLocalOutlet(twin.item.source)) {
      twin.item = item;
    }
  }

  return kept.map((k) => k.item);
}

/**
 * One attempt. Separated from `fetchNews` so the retry below is obviously a
 * retry of exactly this, and so the failure reason it returns is the real one
 * rather than a generic message chosen at the call site.
 */
async function attemptNews(
  googleNewsUrl: string,
  timeoutMs: number,
): Promise<NewsResult> {
  try {
    // Force an early escape rather than hanging a request on a slow upstream.
    // `AbortSignal.timeout` rather than an AbortController and a setTimeout to
    // cancel by hand: the manual version needed a `clearTimeout` on the success
    // path *and* in the catch, which is two chances to leak a pending timer on
    // a route that runs per request. Same mechanism openStates.ts uses, though
    // the budgets stay separate constants — they're the same 8s for unrelated
    // reasons, and tuning one shouldn't move the other.
    const response = await fetch(googleNewsUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      // Carry the status. "Feed unavailable" and "Google answered 429 to this
      // datacenter IP" call for completely different fixes, and the old code
      // made them indistinguishable from outside.
      //
      // Not retryable. A status is Google having answered — it read the
      // request and refused it — and an immediate identical request gets the
      // identical refusal. Confirmed against the live deployment during a 503:
      // both attempts returned 503, so the second only ever added a round trip
      // to a request that was already going to fail. Recovery is the cache's
      // backoff to schedule, not this function's to keep guessing at.
      return {
        ok: false,
        reason: `Google News returned ${response.status}.`,
        retryable: false,
      };
    }

    const xmlText = await response.text();
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];

    const parsed = itemMatches.map((itemXml) => {
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);

      // Decoded on the way in, once, for every field that is read rather than
      // matched on. XML requires an ampersand in a text node to arrive escaped,
      // so a real headline — "Q&A: Minnesota environmental group leader talks
      // data center review process" — reaches us as `Q&amp;A: …`, and every
      // surface that renders it (the prerendered rail, the client re-render,
      // the phone ticker) sets it as *text*, which is exactly what shows the
      // entity to the reader instead of the character. The link needs it too:
      // `&amp;` between query parameters is not the URL Google published.
      let fullTitle = decodeEntities(titleMatch ? titleMatch[1] : "Local Update");
      let source = decodeEntities(sourceMatch ? sourceMatch[1] : "Local News");
      const description = decodeEntities(descMatch ? descMatch[1] : "");

      if (fullTitle.includes(` - ${source}`)) {
        fullTitle = fullTitle.split(` - ${source}`)[0];
      }

      // The Dakotas are rewritten before matching, because "North Dakota county
      // commissioner" literally contains the substring "dakota county" and so
      // introduced both Dakotas to a Minnesota feed the moment the county list
      // arrived — a Fargo Forum piece on a commissioner resigning over a data
      // center debate, and another on a western North Dakota county, both
      // caught this way.
      //
      // The sentinel has to end in something other than "dakota": joining the
      // words to "north_dakota" leaves "north_dakota county", which still
      // contains "dakota county" one character in. Appending `_state` is what
      // actually breaks the adjacency. `\b` keeps a bare "Dakota County" —
      // Minnesota's — untouched.
      const haystack = ` ${fullTitle} ${description} `
        .toLowerCase()
        .replace(/\b(north|south) dakota\b/g, "$1_dakota_state");

      return {
        title: fullTitle,
        url: linkMatch ? decodeEntities(linkMatch[1]) : "#",
        published: pubDateMatch ? pubDateMatch[1] : new Date().toString(),
        source,
        haystack,
      };
    });

    // Compared before filtering: the ceiling applies to what Google returned,
    // not to what survived our relevance test.
    const truncated = itemMatches.length >= GOOGLE_RESULT_CEILING;

    const newsItems = parsed
      .filter((item) => {
        const hasDataCenter = DATA_CENTER_TERMS.some((t) => item.haystack.includes(t));
        // Geography is satisfied either by a place named in the headline or by
        // the outlet being a Minnesota one. The source is checked separately
        // from the haystack rather than folded into it, so that an outlet name
        // can never stand in for the data center half of the test.
        const namesPlace = MINNESOTA_TERMS.some((t) => item.haystack.includes(t));
        const hasMinnesota =
          namesPlace ||
          (isLocalOutlet(item.source) &&
            !OTHER_STATE_PATTERN.test(item.haystack) &&
            !NATIONAL_SCOPE_PATTERN.test(item.haystack));
        return hasDataCenter && hasMinnesota;
      })
      .sort(byPublishedDesc)
      .map(({ haystack, ...item }) => item);

    return { ok: true, newsItems, truncated, partial: false };

  } catch (error) {
    // The old message here claimed "unavailable in dev environment", which was
    // being served in production — the same abort path runs in both, and this
    // was the string a live visitor saw when the 2s budget expired.
    //
    // Both names are checked because they're the same event from two APIs:
    // `AbortSignal.timeout` rejects with `TimeoutError`, while an
    // `AbortController.abort()` (what this used to use) gives `AbortError`.
    const name = (error as Error | undefined)?.name;
    const timedOut = name === "TimeoutError" || name === "AbortError";

    // Both kinds are worth another go — the retry below is the fix for a
    // measured flake where the first connection dropped and an immediate repeat
    // succeeded. A timeout says so too, but having spent the budget saying it,
    // it will be refused a retry for want of time rather than for want of
    // cause. That split is why the decision lives in `fetchOneQuery` and not
    // in this flag.
    return {
      ok: false,
      reason: timedOut
        ? `No response from Google News within ${Math.round(timeoutMs / 1000)}s.`
        : "Couldn't reach Google News.",
      retryable: true,
    };
  }
}

/**
 * Fetch one window, retrying once — but only when a retry could still answer.
 *
 * The retry is not belt-and-braces, it's the fix for a measured failure: on a
 * live deployment the *first* call for a given window intermittently failed
 * while immediate repeats succeeded, so the connection — not the query — is
 * what's flaky. Unlike Open States, Google News RSS enforces no per-minute
 * quota here, so an immediate second attempt is free and almost always works.
 *
 * What that reasoning missed is that it only holds for a connection that never
 * got an answer. Two other cases were being retried on the same terms and paid
 * for it twice:
 *
 *   a status — Google answered, and answered no. The repeat is refused
 *   identically, so it buys a round trip and nothing else.
 *
 *   a timeout — plausibly transient, but the first attempt has already spent
 *   the whole budget establishing that, and a second full budget on top is how
 *   one unanswered window came to cost 16 seconds of a reader's time.
 *
 * So both attempts now draw on one budget, and the retry has to be affordable
 * out of what's left. A dropped connection fails in milliseconds and leaves
 * nearly all of it, which is exactly the case the retry was written for.
 */
async function fetchOneQuery(rawQuery: string): Promise<NewsResult> {
  const query = encodeURIComponent(rawQuery);
  const googleNewsUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const startedAt = Date.now();
  const first = await attemptNews(googleNewsUrl, QUERY_BUDGET_MS);
  if (first.ok || !first.retryable) return first;

  const remaining = QUERY_BUDGET_MS - (Date.now() - startedAt);
  if (remaining < MIN_RETRY_BUDGET_MS) return first;

  // Whatever the second attempt says stands: on success it's the data, and on
  // failure it's the more recent truth about why.
  return attemptNews(googleNewsUrl, remaining);
}

export async function fetchNews(windowDays: number = 7): Promise<NewsResult> {
  const dateQueries = buildDateQueries(windowDays);
  const results = await Promise.all(
    GEOGRAPHY_QUERIES.flatMap((geography) =>
      dateQueries.map((dates) =>
        fetchOneQuery(`"data center" ${geography} ${dates}`),
      ),
    ),
  );

  const succeeded = results.filter((r) => r.ok);

  // Only a total failure is a failure. One query answering is partial coverage,
  // which is worth serving and worth preferring over the cache's last-good
  // copy — the alternative is discarding live headlines because a second
  // search we added for extra reach happened to drop its connection.
  if (succeeded.length === 0) {
    const firstFailure = results.find((r) => !r.ok);
    return (
      firstFailure ?? {
        ok: false,
        reason: "Couldn't reach Google News.",
        retryable: true,
      }
    );
  }

  // The two searches overlap heavily by design — anything naming both a county
  // and the state matches both — so identity is the article URL, which Google
  // keeps stable per item. Titles are the fallback for the same story arriving
  // under two links, and are compared whole: near-identical headlines here are
  // usually genuinely separate items, three different Elk River council votes
  // being the case that made that clear.
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of succeeded.flatMap((r) => r.newsItems)) {
    const key = item.url !== "#" ? item.url : `title:${item.title.trim()}`;
    if (seen.has(key) || seen.has(`title:${item.title.trim()}`)) continue;
    seen.add(key);
    seen.add(`title:${item.title.trim()}`);
    merged.push(item);
  }

  // A search that failed tells us nothing about whether it would have been
  // truncated, so only the ones that answered can report it. A window is
  // reported as truncated if any of them was: the reader is being told the
  // period isn't fully covered, and one cut-off search is enough for that to
  // be true.
  const truncated = succeeded.some((r) => r.truncated);

  return {
    ok: true,
    newsItems: collapseDuplicates(merged.sort(byPublishedDesc)),
    truncated,
    partial: succeeded.length < results.length,
  };
}

/**
 * Build-time adapter, kept for the prerendered first paint in MapParent.astro.
 *
 * That call bakes a snapshot into the static HTML so the panel has something to
 * show before JS runs. It is no longer the source of truth — the client
 * refetches from /api/news on mount — so a failure here costs a blank panel for
 * one paint, not a stale feed until the next deploy.
 */
export async function fetchLocalNews(
  windowDays: number = 7,
): Promise<NewsPayload> {
  const result = await fetchNews(windowDays);
  return result.ok
    ? {
        newsItems: result.newsItems,
        errorMessage: null,
        truncated: result.truncated,
        partial: result.partial,
        // Not stale: this ran moments ago, at build time. It becomes stale in
        // the only sense the panel cares about when the client's own refresh
        // fails and falls back to it — which is the client's fact to record,
        // not this snapshot's, so it is stamped rather than pre-judged.
        stale: false,
        storedAt: new Date().toISOString(),
      }
    : {
        newsItems: [],
        errorMessage: result.reason,
        truncated: false,
        partial: false,
        stale: false,
        storedAt: null,
      };
}