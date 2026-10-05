# NASA WERK ingestion assessment

Research date: 2026-10-02. Scope: primary-source metadata inspection and one 16-byte raster request; no full raster downloads, pixel analysis, or pipeline implementation.

## Recommendation

Start remote-first with the existing Cloud-Optimized GeoTIFFs (COGs). We should make a small, trustworthy catalog and a useful subset workflow before copying statewide data or converting everything to Zarr. The publisher identifies all rasters as COGs, and the sampled 30 m DTM serves HTTP range requests. This supports the access approach, but does not establish performance or COG conformance for every asset. [README][readme] [DTM asset][dtm-asset]

The main work is resolving metadata gaps and making quality limits visible. Choose the destination first: a browser map needs rendering and legends; Python analysis needs named variables and reliable spatial subsets; cadcat integration needs an agreed catalog contract. These are proposed paths, not verified existing integrations.

## Verified inventory

| Product group | What is published | Ingestion consequence |
| --- | --- | --- |
| Six 1 m campaign collections | Five-band tiles ordered DTM, DSM, CHM, slope, aspect; filenames trace back to USGS 3DEP source point clouds. | Preserve campaign identity and band order; defer broad ingestion until an actual local use case exists. |
| Statewide 10 m and 30 m | 21 named single-variable products per resolution: five topographic layers, first-return standard deviation/skewness/kurtosis, six cover measures, seven height percentiles. Filenames identify EPSG:3310. | Treat each resolution as its own product family; confirm grids before combining variables. |
| Acquisition provenance | Root-level campaign-year rasters at both resolutions and a campaign GeoPackage subset of USGS work-unit metadata. | Retain acquisition year and campaign footprint alongside values. |

Definitions and band order come from the [README][readme]; file inventory comes from the [root][root], [30 m][listing30], and [10 m][listing10] listings. The GeoPackage was not opened.

Approximate transfer sizes, summed from rounded directory labels: **31.4 G** for the 21 named 30 m products and **271 G** for the 21 named 10 m products. These are planning totals in the listing's units, not byte-accurate GB measurements. They exclude 1 m tiles, metadata sidecars, and the separately listed **35G `statewide-10m/dtm.tif`**, whose relationship to the named DTM is unresolved. Do not assume it is a duplicate. The root lists year rasters at **78M / 10M** (10 m / 30 m) and the campaign GeoPackage at **327M**. [Listings][root] [30 m][listing30] [10 m][listing10]

The source [LICENSE][license] is CC0 1.0; the inspected [30 m collection][collection30] reports `CC0-1.0`. Retaining publisher attribution and source lineage is still our recommended scientific practice.

## Access and catalog checks

**Range reads work for the sampled asset.** A guarded request to the [30 m DTM][dtm-asset] returned `206 Partial Content`, `Content-Length: 16`, and `Content-Range: bytes 0-15/1589450653`. The server also returned `Accept-Ranges: bytes` and `Access-Control-Allow-Origin: *`. The 16 bytes begin with a little-endian BigTIFF signature. Browser rendering, overviews, and sustained read speed remain untested.

Probe used; the size/time guards prevent an accidental full-asset transfer:

```bash
curl --fail --silent --show-error --location --range 0-15 \
  --max-filesize 16 --max-time 20 --dump-header /dev/stderr \
  https://scil-data.sdsc.edu/data/nasa-werk/statewide-30m/california_statewide_30m_dtm_epsg3310.tif \
  | od -An -tx1
```

**STAC is a starting index, not a verified search service.** The [entry point][catalog] is a static STAC 1.1.0 `Catalog` linking to campaign and statewide collections, including separate percentile collections. No searchable STAC API was established. The advertised [30 m percentile collection][broken-percentiles] returned **404**; the main [30 m collection][collection30] already links to all 21 named products. Reconcile the catalog with the directory inventory rather than trusting either alone.

Four representative items were read: [DTM][dtm-item], [CHM][chm-item], [slope][slope-item], and [first-return cover above 2 m][cover-item]. Each supplies an HTTPS data asset and EPSG:3310 projection metadata, including shape and transform. Their asset URLs were present; only the DTM raster was accessed. None of these four items supplies raster units, nodata, dtype, scale/offset, or checksums.

There is a concrete grid-combination risk: DTM/CHM/slope items describe shape `[35150, 29678]` and origin `(-374430, 450000)`, while the cover item describes `[36487, 30036]` and origin `(-384330, 481560)`. Both report 30 m spacing; their origins differ by whole cells, so the metadata suggests a common lattice with unequal extents, not necessarily a need to resample. Verify against raster headers before alignment. Item geometries are rectangles, not actual valid-data footprints. [DTM item][dtm-item] [Cover item][cover-item]

The inspected collection/items use a 2013-01-01 to 2023-01-01 interval and items have `datetime: null`. The README explicitly says collection timing varies by campaign. Do not interpret the interval as a time series or assign one current-state date to the mosaic. The root listing dates the README to March 2026; raster listings show March 2026 CHM changes and 10 m DTM/DSM changes, whereas the STAC directory lists December 2025 metadata. That warrants a refresh audit, not a claim that every item is stale. [Collection][collection30] [README][readme] [Root][root] [STAC listing][stac-listing] [30 m][listing30] [10 m][listing10]

## What makes it usable and nice

The following is recommended work, not functionality demonstrated in this assessment.

1. **Build a reconciled manifest.** Resolve relative STAC links, account for every intended product, and record source URL, resolution, variable/band definition, license, and retrieval date. Capture exact byte sizes and server validators; distinguish ETags from verified content checksums. Version the manifest and flag broken links or unindexed year/provenance assets.
2. **Verify the raster contract.** Read bounded headers to confirm CRS, transform, bounds, band count, dtype, nodata, scale/offset, and overview layout. Compare them with STAC. Define a common grid and explicit crop/pad rules for unequal extents; preserve valid-data masks rather than treating the bounding rectangle as coverage.
3. **Deliver a remote-first 30 m MVP.** Offer DTM, CHM, slope, and `cc_first_ge2`, with bbox clips and map previews. Include campaign-year information and campaign footprints. Acceptance means a small clip reads without fetching a whole raster, combines layers correctly, and exposes missing coverage and provenance.
4. **Make interpretation visible.** Use readable variable labels and unit-aware legends, transparent nodata, and explicit acquisition-year/quality views. Display stretches may reduce outlier domination without modifying raw values. Provide predictable clipping/export behavior; test map previews on areas with different coverage and known artifacts.
5. **Expose analysis-friendly data.** Return named variables with spatial coordinates and CRS metadata, verified units, validity masks, and `acquisition_year`. Preserve links to campaign footprints and processing provenance. Use spatial dimensions, not a fabricated `time` dimension; different acquisition dates across pixels do not make repeated observations of those pixels.

### Scientific and metadata gates

- **Known artifacts:** the publisher reports unclassified high points propagating into DSM/CHM, plus water/low-return voids causing unrealistic DTM interpolation. Add documented quality flags and optional analysis masks. Do not silently delete legitimate tall trees, buildings, or terrain extremes. Artifact locations and thresholds were not measured here. [README][readme]
- **Cover semantics:** `all` versus `first` refers to lidar return populations, not interchangeable vegetation classes. The README calls the six measures percentages and defines normalized-height thresholds above 2 m, between 2 and 4 m, and between 4 and 8 m. Verify the stored 0-1 versus 0-100 scale and exact boundary/denominator conventions before labeling or normalizing values. [README][readme]
- **Open questions:** vertical datum and elevation/height units, slope units, aspect units/orientation and flat-cell encoding, nodata semantics, resolution derivation, and campaign overlap selection policy remain unresolved from the inspected sources. Ask the publisher before making scientific harmonization claims; the README provides support contacts. [README][readme] [Sample item][dtm-item]
- **Variable-aware resampling:** once units are confirmed, handle aspect circularly; use nearest-neighbor for acquisition year and categorical identifiers. Choose continuous-variable methods for the actual analysis. Never describe resampled cell-level height percentiles as percentiles recomputed from pooled lidar returns. These are methodological recommendations, not verified publisher processing choices.
- **Consistency and corrections:** test bounds/grid alignment and year-raster alignment, then check valid coverage rather than rectangular extents. Audit catalog links and source validators for updates; retain old manifests and separate source fixes from our own derived processing.

## Optional storage and conversion

**Mirror raw COGs only when reliability, traffic, or reproducibility needs justify it.** Use resumable, throttled transfers with retry/backoff and a versioned manifest. Verify exact lengths and compute checksums after transfer; preserve provenance and distinguish corrected upstream versions. Keep the original bytes. The source's CC0 license supports reuse, but hosting capacity and source rate limits were not established. [LICENSE][license]

**Zarr is optional, not a universal first step.** Consider chunked, spatially aligned variables for repeated multi-layer calculations or large regional reductions. Benchmark representative access patterns against COG windows first. Select chunks and compression from those workloads, preserve masks and acquisition-year semantics, and label the result as derived. No Zarr storage size, throughput, or conversion cost was measured. Introduce 10 m and then selected 1 m campaigns only when demand warrants their larger ingest and QA burden.

## Phases and decisions

Relative effort below is **tentative engineering judgment**, not a schedule, measured cost, or person-day estimate. Metadata answers and the destination could change the ranking.

| Phase | Deliverable and exit gate | Relative effort |
| --- | --- | --- |
| 1. Inventory and contract | Reconciled 30 m manifest; broken links recorded; units/nodata and grid rules verified or explicitly unresolved. | Low-medium; publisher clarification is an external dependency. |
| 2. Remote MVP | Four layers, bbox clips, previews, and acquisition provenance; bounded reads and alignment demonstrated. | Medium; browser serving differs from Python/cadcat integration. |
| 3. Scientific QA | Coverage checks and documented artifact flags; temporal interpretation and variable-specific handling tested. | Medium-high; depends on required scientific assurance. |
| 4. Scale if justified | Optional mirror or benchmarked Zarr derivative; add 10 m / selected 1 m products. | High relative to MVP; transfer and operational scope are unmeasured. |

**Decision needed:** browser map, Python access, or cadcat publication first; target hosting location; priority geography; and whether reproducible pinned copies are required. Until those choices are made, proceed with the remote 30 m MVP and metadata clarification rather than a bulk statewide conversion.

[root]: https://scil-data.sdsc.edu/data/nasa-werk/
[readme]: https://scil-data.sdsc.edu/data/nasa-werk/README
[license]: https://scil-data.sdsc.edu/data/nasa-werk/LICENSE
[listing30]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-30m/
[listing10]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-10m/
[stac-listing]: https://scil-data.sdsc.edu/data/nasa-werk/stac/
[catalog]: https://scil-data.sdsc.edu/data/nasa-werk/stac/catalog.json
[collection30]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/collection.json
[broken-percentiles]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m-canopy-percentiles/collection.json
[dtm-item]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/california_statewide_30m_dtm_epsg3310/california_statewide_30m_dtm_epsg3310.json
[chm-item]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/california_statewide_30m_chm_epsg3310/california_statewide_30m_chm_epsg3310.json
[slope-item]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/california_statewide_30m_slope_epsg3310/california_statewide_30m_slope_epsg3310.json
[cover-item]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/california_statewide_30m_cc_first_ge2_epsg3310/california_statewide_30m_cc_first_ge2_epsg3310.json
[dtm-asset]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-30m/california_statewide_30m_dtm_epsg3310.tif