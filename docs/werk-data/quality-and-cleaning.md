# Quality and cleaning

## Publisher-reported source issues

The [SDSC README](https://scil-data.sdsc.edu/data/nasa-werk/README) describes:

- **DSM/CHM outliers**: source 3DEP point clouds can contain unrealistically
  high, unclassified Class 1 points. The workflow includes Class 1 points in
  DSM generation; CHM is calculated as DSM minus DTM, so these outliers can
  propagate into both products.
- **DTM voids and interpolation artifacts**: lidar returns can be sparse or
  absent, especially over small water bodies. The publisher says TIN
  interpolation can produce unrealistic DTM surfaces and abrupt terrain
  features in such areas.

The publisher does not give a universal numeric high-value cutoff or an
authoritative artifact mask in that README. Real trees, buildings, or terrain
can also produce unusual values. An extreme is a reason to inspect, not proof
of invalid data.

## Additional source defects found by bounded checks

The [2026-10-13 source review](source-review.md) inspected raster headers and
small windows, not complete rasters. It found:

- Statewide DTM, DSM, and CHM files inspected had no declared header nodata.
  DTM/DSM contained `-9999` at sampled off-land fill pixels. At corresponding
  locations CHM was `0.0`, because subtracting identical fill values yields
  zero. This is a confirmed source-level false-zero case. It does not establish
  that every CHM zero is missing.
- Slope and aspect declared NaN nodata in inspected files, but their embedded
  mean and standard-deviation statistics were the literal string `-9999`.
  Do not trust those embedded statistics without checking values independently.
- The inspected cover and percentile product grids differ from the
  DTM/DSM/CHM/slope/aspect grid, even within the same CRS and resolution.
  Align explicitly before cellwise operations.
- The separate 10 m `dtm.tif` in the directory listing is not the named
  catalogued statewide DTM; the source review found it non-COG and not linked
  from the STAC collection. Use the named product unless its origin is clarified.

These findings are scoped to the assets and samples in the cited review.
Refresh metadata and verify the relevant source file before applying them to
another version.

## Cleaning implemented by this project

The browser [`cleanValue`](../../src/raster.js) and Python
[`read_preview`](../../python/nasa_werk_viewer.py) currently implement these
rules for the viewer workflow:

| Rule | Current behavior |
|---|---|
| Non-finite samples | Excluded from display and statistics. |
| Declared nodata | Removed when it exactly matches the source's declared value. |
| Fill sentinel | Values within `0.05` of `-9999` are removed. |
| CHM source validity | Browser and Python viewers also read aligned DTM and DSM windows and mask CHM wherever either input is non-finite, declared nodata, or within `0.05` of `-9999`. Valid-input zero heights remain. |
| Negative canopy height | Negative `chm` values are masked; zero remains unless its corresponding DTM or DSM input is missing. |
| Other signed variables | Negative values are retained. |
| Positive outliers | Retained; no universal upper cutoff is applied. |
| Color stretch | 2nd–98th percentile is a rendering default. It changes display colors only, not stored preview values. |

The browser reads native pixels for CHM because the source CHM overviews were
found to contain contaminated coarse values. It reads the corresponding
DTM/DSM windows and verifies their CRS, dimensions, origin, and resolution
before using them as a validity mask. If either companion read fails or the
grids differ, the preview fails with an error rather than showing unvalidated
CHM values. Other layers can use overviews. Downloads and displayed statistics
remain resampled previews.

This masks the confirmed false-zero case when one or both CHM inputs contain
the known fill sentinel. It does not validate all CHM source quality or
distinguish other undocumented source defects. Do not describe every zero as
missing, and do not silently patch the original data.

The publisher-endorsed statewide visualization notebook has a plotting helper
that masks declared nodata, values near `-9999`, values below `-9000`, values
above `4000`, NaN, and infinity. A separate fire-CHM notebook uses a different
range heuristic (`-10 < CHM < 100`). These are examples for visualization,
not a universal cleaning specification. A generic `>4000` filter is especially
unsuitable across variables and can remove real California high-elevation
values. See the [pinned notebook evidence](source-review.md).

## Recommended QA workflow

1. Preserve source pixels. Record source URL, asset version or retrieval date,
   resolution, CRS/grid, product code, and all derived operations.
2. Inspect header nodata, dtype, scale/offset, and overview behavior for the
   exact asset. Do not assume adjacent products share a mask.
3. Apply declared nodata, then only additional sentinels supported by
   evidence for that source family. DTM/DSM/CHM need explicit `-9999` handling
   because their inspected headers omit nodata.
4. Keep missingness distinct from valid zero. For the statewide CHM viewer,
   derive invalidity from the aligned DTM/DSM source windows; keep genuine
   zero-height cells when both inputs are valid. Other data workflows need
   their own validated source-validity mask.
5. Report unusual ranges and spatial patterns before masking them. Keep
   analyst-defined masks separate and reversible.
6. Align grids before combining products. Confirm pixel origin, transform,
   extent, CRS, and valid-data coverage, not just nominal resolution.
7. Test rules on nodata, near-sentinel, valid zero, legitimate negative
   terrain/statistics, and extreme values. Include the asset and rule scope.

Avoid universal elevation/height limits, neighborhood clipping, or blanket
water masks without product-specific validation. Do not represent a robust
display stretch as data cleaning.
