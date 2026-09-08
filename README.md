# PLAN / VIC

Town planning report generator for Victorian residential development projects.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Workflow data reference

The report builder stores one report object in browser `localStorage` under `planning-report`. Every wizard screen writes to that object, so **Save & exit** and browser refreshes preserve the current draft.

| Step | Data captured |
| --- | --- |
| 1 | `address`; Vicmap lookup is initiated here |
| 2 | `zone`, `zoneDescription`, `overlays`, `lga`; all values remain editable |
| 3 | `dwellings`, `storeys`, `parking`, `parkingOther` |
| 4 | `existing` site condition |
| 5 | `siteArea` in square metres |
| 6 | `frontage` in metres |
| 7 | `frontageStreet` |
| 8 | Satellite context image, replaceable by the user |
| 9 | Zoning map image, replaceable by the user |
| 10 | One overlay map image per overlay, replaceable by the user |
| 11-14 | `siteCoverage`, `permeable`, `gardenArea`, `canopy` in square metres |
| 15 | `summary`, intended to be approximately 70 words |
| 16 | `openSpace[]`, with secluded and total private open space per dwelling |
| 17 | `ordinance`, filtered to A values for one dwelling or B values for multiple dwellings |
| 18 | `maxHeight`, including `None specified` where applicable |
| 19 | Garden requirement and achieved percentage confirmation |

## Calculation rules

Garden requirement is calculated from total site area:

- 400-500 m²: minimum 25%
- Greater than 500 m² up to 650 m²: minimum 30%
- Greater than 650 m²: minimum 35%

Achieved garden percentage is `gardenArea / siteArea * 100`, rounded to the nearest whole percentage.

## Backend

Run the API separately with `npm run server`, or run both services with `npm run dev:full`. The API uses an HTTP-only cookie session and stores users, sessions, and projects in `data/store.json` for local development. Passwords are salted and hashed with Node's `scrypt`; plaintext passwords are never stored.

Available routes:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:projectId`, `DELETE /api/projects/:projectId`
- `GET /api/vicmap/lookup?address=...`
- `GET /api/planning/standards?lga=...&zone=...&dwellings=...`

The standards endpoint uses Puppeteer to render `planning-schemes.app.planning.vic.gov.au/{LGA}/ordinance/{ZONE_CLAUSE}`, scrape `table.ordinance-section__table.clause-1`, and filter the `Standard` column by `A` for one proposed dwelling or `B` for multiple dwellings. Supported zone mappings are `GRZ -> 32.08`, `NRZ -> 32.09`, and `RGZ -> 32.07`; the schedule number is taken from the numeric suffix, for example `GRZ1 -> 32.08-s1`. Unsupported prefixes return a manual-entry response.

The scraper uses `@sparticuz/chromium`, which bundles a portable Chromium binary for Codespaces and avoids requiring system GTK libraries. Set `PUPPETEER_EXECUTABLE_PATH` only when deploying with an existing Chrome/Chromium installation.

## Integration notes

The address lookup now runs through the backend proxy. It first resolves the address through the ArcGIS World Geocoder in WGS84, then queries `Vicmap_Parcel` by that geocoded point. This avoids the parcel layer's unreliable full-address text search, which could return a parcel from the wrong part of Victoria. The resulting parcel polygon is then used in spatial intersects queries against `Vicmap_Planning`:

- Layer `3`: planning scheme zones, returning `zone_code`, `zone_description`, and `lga`
- Layer `2`: planning scheme overlays, returning `zone_code`, `zone_description`, and `lga`

The response includes the geocoder's `location.longitude` and `location.latitude` in WGS84, alongside parcel geometry in Web Mercator (EPSG:3857). The planning service uses Web Mercator, so parcel intersects are performed in `3857` to avoid a projection mismatch. Site area is calculated geodesically from the returned polygon after converting it from Web Mercator, rather than using ArcGIS `Shape__Area` directly. This avoids inflated areas such as `1285.7 m²` becoming the correct `803.9 m²` for 30 Haig Street. The raw service value remains available under `raw.parcel.Shape__Area` for diagnostics. The address lookup now uses the geocoder rather than treating the parcel layer as an address source for:

- Vicmap Parcel FeatureServer lookup and geometry-derived site area
- ArcGIS satellite, zoning, and overlay exports
- Puppeteer scraping of `planning-schemes.app.planning.vic.gov.au/{LGA}/ordinance/{ZONE_CLAUSE}`

Zone clause mapping for the scraper is `GRZ -> 32.08`, `RGZ -> 32.07`, and `NRZ -> 32.09`; unsupported zone prefixes should expose a manual ordinance entry, as the UI does today.
