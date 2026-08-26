#!/usr/bin/env node
// scripts/lookup-facility-coordinates.mjs
//
// One-off lookup tool, not a maintained ingest pipeline — see
// research/facility-pins-spec.md §2.3 for why this repo has one script
// instead of a scripts/ingest/ directory. Queries EPA's Facility Registry
// Service (FRS) REST API by facility name and prints every candidate match
// for a human to review before hand-copying a coordinate into
// src/data/mnPollutionFacilities.ts with its FRS Registry ID cited.
//
// FRS facility-name search is fuzzy ("Contains", not exact) and large
// industrial sites often have many FRS sub-records — the plant, a landfill,
// a pipeline segment, a tailings basin, a mining-area boundary — each with
// its own registry id and sometimes its own coordinates a few km apart. This
// tool does not guess between them. It prints every candidate with its city
// and county so a human can pick the one that represents the facility, the
// way this session did for the 16 rows already in mnPollutionFacilities.ts.
//
// Usage:
//   node scripts/lookup-facility-coordinates.mjs "united taconite"
//   node scripts/lookup-facility-coordinates.mjs "united taconite" MN
//
// Dependency-free per CLAUDE.md §6 — fetch() is a Node built-in, no npm
// package required. Network access needed; nothing here runs at build time
// or in the browser.

const FRS_ENDPOINT = 'https://ofmpub.epa.gov/frs_public2/frs_rest_services.get_facilities';
const USER_AGENT = 'mndatacenter.org facility coordinate lookup (one-off manual tool; contact via github.com/ngabantudev/mndatacenter)';

async function lookup(name, state = 'MN') {
  const url = `${FRS_ENDPOINT}?state_abbr=${encodeURIComponent(state)}&facility_name=${encodeURIComponent(name)}&output=JSON`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`FRS request failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (!text.trim()) return [];
  // Real shape, confirmed against a live response (2026-08-25):
  // { "Results": { "FRSFacility": [ { RegistryId, FacilityName, CityName,
  //   CountyName, Latitude83, Longitude83, ... } ] } }
  // A single-match response can return an object instead of a one-item
  // array — normalize both to an array.
  const parsed = JSON.parse(text);
  const facility = parsed?.Results?.FRSFacility ?? [];
  return Array.isArray(facility) ? facility : [facility];
}

function printCandidates(name, records) {
  console.log(`\n=== "${name}" — ${records.length} candidate(s) ===`);
  if (records.length === 0) {
    console.log('  (no matches — try a shorter or different keyword)');
    return;
  }
  for (const r of records) {
    const lat = r.Latitude83;
    const lon = r.Longitude83;
    const hasCoords = lat != null && lon != null && lat !== '' && lon !== '';
    console.log(
      `  ${hasCoords ? '✓' : '·'} ${r.FacilityName ?? '(unnamed)'} ` +
        `| registry_id=${r.RegistryId ?? '?'} ` +
        `| ${hasCoords ? `${lat}, ${lon}` : 'no coordinates'} ` +
        `| ${r.CityName ?? '?'}, ${r.CountyName ?? '?'}`,
    );
  }
  console.log(
    '  Pick the record whose name most closely matches the facility as named\n' +
      '  in mnPollutionScale.ts, prefer one WITH coordinates, and prefer the\n' +
      "  plant/company-level record over a sub-site (landfill, pipeline, pond,\n" +
      '  mining-area boundary) unless that sub-site is specifically what the\n' +
      '  pin is meant to represent. Record the registry_id used as the citation.',
  );
}

const [, , query, state] = process.argv;
if (!query) {
  console.error('Usage: node scripts/lookup-facility-coordinates.mjs "<facility name keyword>" [state=MN]');
  process.exit(1);
}

const records = await lookup(query, state);
printCandidates(query, records);
