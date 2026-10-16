# NASA WERK data guide

Use this guide before selecting, interpreting, cleaning, combining, or
exporting a WERK raster. It separates publisher statements from bounded
checks in this repository and from analyst recommendations.

## Topic map

- [Products and units](products-and-units.md): inventory, variable meanings,
  unit evidence, and unresolved semantic conventions.
- [Quality and cleaning](quality-and-cleaning.md): publisher-reported
  artifacts, actual viewer masks, and safe quality-control practice.
- [Using the data](using-the-data.md): resolution choice, use cases,
  combination, resampling, and reporting guidance.
- [Primary-source review](source-review.md): cited source audit, raster
  metadata/pixel checks, discovered issues, and remaining questions.
- [Detailed unit evidence](../variable-units.md): publisher notebook
  pinpoints and sampled percentage encoding.
- [Initial ingestion assessment](../ingestion-assessment.md): historical
  catalog and access investigation. It predates some later checks.

## Evidence labels

Use the labels consistently in docs, interface text, and analysis notes:

- **Publisher-documented**: stated by NASA WERK or the SDSC data publisher.
- **Project-checked**: verified in this repository's source code, tests, or
  bounded inspection of a named asset. State the scope.
- **Interpretation**: a cautious recommendation, not a claim about the
  publisher's production algorithm.
- **Unresolved**: not established by available sources or checks.

An example notebook can establish a publisher's intended display label. It
does not establish undocumented production code or a universal validity
threshold. Likewise, a few sampled pixels cannot establish statewide
distributions or a valid-data range.

## Core cautions

The publisher describes the statewide products as a mosaic from campaigns
whose acquisition dates vary. `campaign_year` is per-pixel provenance, not a
time axis of repeated observations. The publisher reports high DSM/CHM
outliers and TIN-interpolation artifacts in DTM areas with sparse or missing
returns, especially around water.

This repository's browser renders remote statewide 30 m rasters as
resampled EPSG:3857 previews. Its values, point samples, and statistics refer
to preview pixels. They are not native-resolution analysis results. For CHM,
the browser also reads aligned DTM and DSM windows and masks values where
either source is nodata or fill. This catches the documented fill-derived
false-zero case while preserving valid zero-height cells. See [quality and
cleaning](quality-and-cleaning.md).

Before changing data handling:

1. Read the relevant topic page and the matching evidence in the
   [primary-source review](source-review.md).
2. Check the exact asset, resolution, band, declared nodata, scale/offset,
   grid, and acquisition context.
3. Keep visualization stretches separate from masks that alter valid values.
4. Test every deterministic cleaning rule against valid zero, negative,
   nodata, and extreme cases where applicable.
5. Preserve uncertainty and provenance; do not silently turn a heuristic
   into a source-data fact.

Research reflects the sources and asset responses inspected on
2026-10-13. The publisher is updating files; verify current metadata before
using dated observations as current truth.
