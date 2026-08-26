// scripts/refresh-news.ts
//
// Fetches each news window from a GitHub Actions runner and writes one JSON
// file per window for the workflow to upload into KV. See ~/lib/newsMirror.ts
// for why this exists at all — the short version is that Google answers a
// runner and refuses this project's Worker, and no change to the Worker fixes
// that.
//
// IT IMPORTS THE APP'S OWN FETCH, and that is the only interesting decision
// here. Everything about which stories count as Minnesota data center news —
// the two geography queries, the 90-day segmenting, the outlet list, the state
// and national-scope guards, the duplicate collapse — lives in
// ~/lib/newsFeed.ts and is the product of a lot of measurement. Reimplementing
// any of it here would create a second definition of the feed that drifts from
// the one the Worker still falls back to, which is exactly the class of bug
// this codebase keeps deleting. So this file is a runner, not a fetcher: it
// calls `fetchNews` and serialises the answer.
//
// Run with `npx tsx scripts/refresh-news.ts`.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchNews } from "../src/lib/newsFeed";
import {
  MIRRORED_WINDOWS,
  newsMirrorKey,
  type NewsMirror,
} from "../src/lib/newsMirror";

/** Where the workflow picks the files up. Gitignored. */
const OUT_DIR = ".news-mirror";

/**
 * Windows are fetched one at a time, not in parallel.
 *
 * `fetchNews` already fans out internally — a year is two geography queries
 * across four date segments, so eight upstream calls — and firing all four
 * windows at once would put roughly twenty concurrent requests on Google from a
 * single runner IP. That is the shape of traffic that gets an IP blocked, which
 * is the problem this script exists to route around. Sequential costs a couple
 * of minutes of Actions time and nothing else.
 */
async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  const failures: string[] = [];

  for (const windowDays of MIRRORED_WINDOWS) {
    const result = await fetchNews(windowDays);

    if (!result.ok) {
      // Not fatal on its own — see the exit rule below.
      failures.push(`${windowDays}d: ${result.reason}`);
      console.error(`✗ ${windowDays}d — ${result.reason}`);
      continue;
    }

    // An empty-but-successful fetch is mirrored as the fact it is. Skipping it
    // would leave the previous mirror in place until its TTL, which would serve
    // last period's headlines as this one's — the exact confusion the ok/failed
    // split in newsFeed.ts exists to prevent.
    const mirror: NewsMirror = {
      items: result.newsItems,
      truncated: result.truncated,
      partial: result.partial,
      fetchedAt: new Date().toISOString(),
    };

    const file = join(OUT_DIR, `${windowDays}d.json`);
    await writeFile(file, JSON.stringify(mirror), "utf8");
    written += 1;

    const flags = [
      result.truncated ? "truncated" : null,
      result.partial ? "partial" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `✓ ${windowDays}d — ${result.newsItems.length} items${flags ? ` (${flags})` : ""} -> ${newsMirrorKey(windowDays)}`,
    );
  }

  // Exit non-zero only when nothing at all was written. One window failing is
  // normal — a dropped connection on a 1Y fetch is what `partial` is for — and
  // failing the whole run for it would skip the three that worked, letting
  // every mirror age out over something recoverable. Zero windows means the
  // runner cannot reach Google either, which is worth a red build.
  if (written === 0) {
    console.error(
      `\nNo windows fetched. Google is refusing this runner too:\n  ${failures.join("\n  ")}`,
    );
    process.exit(1);
  }

  if (failures.length > 0) {
    console.log(`\n${written} written, ${failures.length} failed (kept last mirror for those).`);
  }
}

await main();
