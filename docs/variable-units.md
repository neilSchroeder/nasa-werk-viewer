# NASA WERK LiDAR Variable Units

Research date: 2026-10-03. Dataset: <https://scil-data.sdsc.edu/data/nasa-werk/>.

The publisher-endorsed statewide visualization notebook explicitly labels elevation and height statistics in metres, slope and aspect in degrees, and all six canopy-cover products in percent. This is direct publisher evidence, not an inference from EPSG:3310. Skewness and kurtosis are dimensionless by their statistical definitions; the notebook leaves their unit strings empty. Acquisition year is the year of LiDAR collection. [S1][S2][S5]

**Evidence scope:** the unit configuration targets the **30 m** rasters. The README lists the same science variables for both 10 m and 30 m products, supporting the same intended interpretation at 10 m, but it does not independently certify their encoding. The separate fire notebook explicitly labels **1 m CHM** in metres for its four LA example tiles. Do not extend that verification to every campaign or every 1 m band without checking the source metadata. [S1][S2][S3]

## Complete Inventory

P = explicit publisher unit label; D = dimension-derived statistical fact. "Direct intended" means the notebook displays samples without a unit conversion. Independent header checks confirm identity scale/offset for all 22 inspected 30 m layers; bounded cover samples additionally verify percentage-point encoding at 10 m and 30 m. The production writer was not found. All source pinpoints are below.

| Variable | Physical unit | Stored scale / interpretation | Evidence and exact pinpoint |
| --- | --- | --- | --- |
| `dtm` | m (P) | Direct intended elevation; vertical datum unresolved | [S2], Cell 1, `PRODUCT_CONFIG['dtm']['units']='m'`, source line 345 |
| `dsm` | m (P) | Direct intended surface elevation; vertical datum unresolved | [S2], Cell 1, `dsm.units='m'`, line 353 |
| `chm` | m (P) | Direct intended height above ground; DSM minus DTM | [S2], Cell 1, `chm.units='m'`, line 361; [S1], Known Issues; [S3], Cell 1, `Height (m)` |
| `slope` | degrees (P) | Direct intended angle, not percent grade or radians; operator unresolved | [S2], Cell 1, `slope.units` is the degree symbol, line 377 |
| `aspect` | degrees (P) | Direct intended angle; azimuth convention and flat marker unresolved | [S2], Cell 1, `aspect.units` is the degree symbol, line 369 |
| `sd_first` | m (P) | Direct intended standard deviation of first-return heights; input normalization and estimator unresolved | [S2], Cell 1, `sd.units='m'`, line 497; URL maps `sd` to `sd_first` |
| `skewness_first` | dimensionless, unit 1 (D) | Unscaled coefficient intended; estimator unresolved | [S2], Cell 1, `skewness.units=''`, line 505; [S5], Definition of Skewness |
| `kurtosis_first` | dimensionless, unit 1 (D) | Unscaled coefficient intended; Pearson versus excess kurtosis unresolved | [S2], Cell 1, `kurtosis.units=''`, line 513; [S5], Definition / Alternative Definition of Kurtosis |
| `cc_all_ge2` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: all canopy returns above 2 m normalized height; [S2], Cell 1, `cc_all_ge2.units='%'`, line 387; independent samples below |
| `cc_all_2_4` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: all canopy returns above 2 m and below 4 m; [S2], Cell 1, `cc_all_2_4.units='%'`, line 395; independent samples below |
| `cc_all_4_8` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: all canopy returns above 4 m and below 8 m; [S2], Cell 1, `cc_all_4_8.units='%'`, line 403; independent samples below |
| `cc_first_ge2` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: first canopy returns above 2 m normalized height; [S2], Cell 1, `cc_first_ge2.units='%'`, line 413; independent samples below |
| `cc_first_2_4` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: first canopy returns above 2 m and below 4 m; [S2], Cell 1, `cc_first_2_4.units='%'`, line 421; independent samples below |
| `cc_first_4_8` | % (P) | Stored percentage points, nominal 0-100; denominator unresolved | [S1], map-type definition: first canopy returns above 4 m and below 8 m; [S2], Cell 1, `cc_first_4_8.units='%'`, line 429; independent samples below |
| `p10_first` | m (P) | Direct intended 10th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p10.units='m'`, line 439; URL explicitly contains `p10_first` |
| `p25_first` | m (P) | Direct intended 25th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p25.units='m'`, line 447; URL contains `p25_first` |
| `p50_first` | m (P) | Direct intended 50th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p50.units='m'`, line 455; URL contains `p50_first` |
| `p75_first` | m (P) | Direct intended 75th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p75.units='m'`, line 463; URL contains `p75_first` |
| `p90_first` | m (P) | Direct intended 90th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p90.units='m'`, line 471; URL contains `p90_first` |
| `p95_first` | m (P) | Direct intended 95th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p95.units='m'`, line 479; URL contains `p95_first` |
| `p99_first` | m (P) | Direct intended 99th-percentile first-return height; ground reference unresolved | [S2], Cell 1, `p99.units='m'`, line 487; URL contains `p99_first` |
| `campaign_year` (auxiliary label) | calendar collection year (P) | Year identifier, not elapsed years; stored encoding and missing-year code unresolved | [S1], Spatial Metadata: pixel-level year GeoTIFF "identifies the year the lidar data was collected" |

## Exact Publisher Evidence

The README's Additional Resources section links the visualization repository, establishing publisher endorsement. All three notebooks were fetched as raw JSON at commit `1016755399e9c94f2af7fc4dbd57ddf9c4522f8d`. They contain no markdown cells: their evidence is in code, docstrings, and saved outputs. [S1][S2][S3][S4]

In [S2], Cell 1, `read_cog_overview` reads `levels[level_idx].asarray()` or `tif.asarray()` and returns the samples (source lines 257-333). `visualize_statewide` masks them, passes `data` directly to `imshow`, and builds the colorbar label from `config['units']` (lines 657-704). Neither path multiplies by 100, converts radians, or applies a vertical-unit conversion. This supports the **intended direct sample interpretation** in the table. It cannot prove the labels or every distributed file are correct.

The configuration supplies the degree symbol for both terrain angles, `%` for every cover layer, and `m` for every named height percentile. Its `vmin_percentile` and `vmax_percentile` fields select display limits; they are not physical units or storage scaling factors. [S2], Cell 1, configuration and `np.percentile(valid_data, ...)` at lines 684-685.

In [S3], Cell 1, `load_and_align_chms(..., chm_band=3)` reads the third band from LA B23 and post-fire Palisades/Eaton C25 tiles. `create_fire_comparison_panel` uses the title `LA Wildfires - Height Above Ground Maps (2025)` and labels CHM colorbars `Height (m)` and residuals `Change (m)`. Reprojection aligns grids but no explicit height-unit conversion occurs. The saved output includes the comparison figure.

In [S4], Cell 6's saved output lists DTM, DSM, CHM, Slope, Aspect in that order, with names only. Cell 8 plots those bands without explicit unit labels. This corroborates band order, **not** units or the terrain operator. The statewide notebook's saved plots are DTM and p95 examples, not executed examples of every configuration entry.

## Independent Raster Checks

On 2026-10-03, bounded HTTP reads inspected all 22 [30 m science and year assets][S6]. Every header reported band units `None`, scale `1`, and offset `0`, explaining why metadata-only access cannot label the units. Slope's band statistics report minimum 0 and maximum 89.999893 degrees; aspect reports 0-360. These corroborate [S2] but do not define the aspect orientation or validate every pixel.

All six cover products were sampled at both resolutions in the Santa Cruz Mountains bounding box `(-122.30, 37.00, -121.85, 37.35)`, using nearest-neighbor decimation to a longest edge of 256 pixels. Raw samples were not multiplied by 100. The table reports finite preview samples after masking source fill near -9999; these are encoding checks, not statewide summary statistics or a guarantee that all pixels are in range. Asset URLs follow the exact [S1] filename convention in the [30 m][S6] and [10 m][S7] directories.

| Cover variable | 30 m median / maximum | 10 m median / maximum |
| --- | --- | --- |
| `cc_first_ge2` | 84.745 / 99.910 | 82.011 / 99.943 |
| `cc_all_ge2` | 80.161 / 99.385 | 76.256 / 99.286 |
| `cc_first_2_4` | 5.295 / 66.603 | 4.996 / 63.930 |
| `cc_all_2_4` | 6.420 / 59.966 | 5.784 / 58.158 |
| `cc_first_4_8` | 8.869 / 58.644 | 7.835 / 68.359 |
| `cc_all_4_8` | 10.095 / 56.609 | 8.734 / 54.344 |

Combined with the explicit publisher percent labels, these observations confirm percentage-point encoding at both resolutions. A stored value of 84.745 means 84.745%, not 8,474.5%. To obtain a dimensionless proportion, divide by 100.

## Unresolved Scientific Conventions

**Elevation versus height:** the README states CHM is DSM minus DTM, making it a relative height product. It identifies TIN interpolation for DTM and inclusion of Class 1 points in DSM, but names no processing library. Metres do not establish an absolute vertical datum: NAVD88, an ellipsoidal reference, geoid model, epoch, and cross-campaign vertical transformations remain undocumented in the inspected sources. EPSG:3310 identifies the statewide horizontal grid, not those vertical properties. [S1], Known Issues; [S2], topographic configuration.

**Height-statistic input:** the cover definitions explicitly say "normalized height" and give metre thresholds. Percentiles are only called "Height of First Returns"; the supplied sources do not show whether their inputs are pointwise heights above ground, absolute Z, or another intermediate. The same gap affects `sd_first`, skewness, and kurtosis. Pointwise terrain subtraction is not equivalent to subtracting one common elevation from a cell's statistics. Do not describe them as verified normalized-height statistics yet. [S1], map-type definitions; [S2], Height Percentiles / Structure Metrics.

**Cover denominator:** percentage-point storage is independently verified above. The sources do not specify whether the denominator includes ground returns, only canopy returns, all valid returns, pulses, or a classification-filtered subset. "All" versus "first" names the return selection but does not completely define that denominator. Confirm before interpreting the six layers as geometric canopy-area fractions. [S1][S2]

**Threshold boundaries:** the README says "above 2 meters" whereas the notebook descriptions use `>=2m` (rendered with a greater-than-or-equal symbol). Interval labels only say 2-4 m and 4-8 m in the notebook. Strict versus inclusive endpoints need the production predicate; do not silently resolve this discrepancy. [S1], cover definitions; [S2], Cell 1, `cc_all_ge2.description` / `cc_first_ge2.description`.

**Terrain angles:** degrees are explicitly labeled, but neither notebook specifies aspect's zero direction, clockwise versus counterclockwise progression, grid versus true north, or flat-terrain sentinel. No WERK invocation of PDAL, `gdaldem`, GRASS, `terra`, or `lidR` was established. Their generic defaults cannot settle WERK's convention. The derivative algorithm, vertical-to-horizontal scaling, and whether angles were recomputed or mosaicked also remain open. [S1][S2][S4]

**Statistical estimators:** dimensionless units do not determine sample-size correction or kurtosis convention. NIST's skewness formulas divide a third-order height moment by a cubed standard deviation; kurtosis divides a fourth-order moment by the fourth power. Height units cancel. NIST also distinguishes kurtosis with normal-reference value 3 from excess kurtosis with value 0. No production formula was found to identify WERK's choice, SD degrees of freedom, percentile interpolation, or minimum-return count. [S5], Definition of Skewness / Definition of Kurtosis / Alternative Definition of Kurtosis.

**Artifacts are not unit evidence:** the publisher warns of unclassified-point outliers in DSM/CHM and DTM interpolation artifacts over sparse returns. The statewide notebook's `mask_nodata` uses approximate `-9999` matching and removes values below -9000 or above 4000; the fire notebook additionally clips its example CHMs to (-10, 100). These are visualization masks, not certified valid ranges. Undeclared fill values, interpolation, or float precision loss can contaminate observed ranges. No unit assignment here relies on extreme sample statistics. [S1], Known Issues; [S2], Cell 1, `mask_nodata`, lines 551-568; [S3], `pre_masked` / `post_masked`.

## Sources Searched And Pipeline Leads

- [NASA WERK project page](https://www.nasa.gov/werk/), Latest Development: LiDAR Data and WERK Questions: confirms the release and says development processes will be hosted publicly, but provides no production-pipeline link or variable-unit specification.
- [NASA product specifications](https://www.nasa.gov/werk/science-data-products/) and [team page](https://www.nasa.gov/werk/meet-the-team/): future tree/building products have height units, but those are not a specification for this raster release.
- [State partner's December 12, 2025 release](https://wildfiretaskforce.org/california-unveils-first-ever-statewide-lidar-maps/): confirms 10/30 m release and selected 1 m coverage; no detailed algorithms or units.
- [WIFIRE 10 m catalog](https://wifire-data.sdsc.edu/dataset/nasa-werk-dem-statewide-10m): confirms layer inventory and metre cover thresholds; no vertical datum or unit encoding. Its Additional Info lists EPSG 4326 while its description says EPSG:3310, so catalog extent metadata must not be used as vertical-unit evidence. The attempted `nasa-werk-dem-statewide-30m-canopy-percentiles` catalog page returned not found.
- [Kyle's public repository inventory](https://api.github.com/users/kylekabasares-nasa/repos?per_page=100) contains only the visualization repository. [Contributor crawld's inventory](https://api.github.com/users/crawld/repos?per_page=100) includes `cfo-api` and FastFuels repositories, but no identified WERK processing repository; those projects are not evidence of this dataset's operators.
- **Useful future pipeline location:** [nasa-werk organization](https://github.com/nasa-werk), whose [public repository inventory](https://api.github.com/orgs/nasa-werk/repos?per_page=100) currently contains only `.github`. Its [profile source](https://raw.githubusercontent.com/nasa-werk/.github/main/profile/README.md) links NASA WERK. [Repository tree](https://api.github.com/repos/nasa-werk/.github/git/trees/main?recursive=1) contains issue templates and README files, not processing code. No verified production-pipeline link was found.
- [NASA Kabasares biography](https://www.nasa.gov/people/kyle-kabasares/), Publications: no release-specific methods paper listed; page last updated November 2024.
- [Related author DOI record](https://api.crossref.org/works/10.1016/j.rse.2026.115646): *Unified knowledge transfer boosts individual tree crown segmentation without scene-specific labels*, by Yang, Kabasares, Liu, Park, Chen. Registered publication date is December 2026; metadata does not establish a WERK raster-processing pipeline. A follow-up lead, not unit evidence.
- [Favrichon et al., DOI 10.3389/frsen.2024.1459524](https://www.frontiersin.org/journals/remote-sensing/articles/10.3389/frsen.2024.1459524/full), Abstract and Sections 2.1-2.5: inspected and excluded as a specification. It maps GEDI-trained RH98 using satellite predictors, not this 21-variable airborne-LiDAR release. Its `lidR` reference does not establish WERK use of that library.
- [AGU 2024 abstract lead](https://studio.m-anage.com/agu/agu24/meetingapp.cgi/Paper/1717046), *Refined Urban Mapping: Integrating LIDAR Data and Aerial Imagery for Enhanced Semantic Segmentation of Trees and Buildings*: discovered through [author/AGU search](https://www.bing.com/search?q=%22Kabasares%22+%22LiDAR%22+%22AGU%22). Direct access returned an application HTML shell, not a readable abstract; no unit claim taken from search-generated summaries.
- [DataCite search](https://api.datacite.org/dois?query=WERK%20AND%20lidar&page%5Bsize%5D=10) and [Crossref search](https://api.crossref.org/works?query.bibliographic=WERK%20California%20lidar%20Park%20Kabasares&rows=8) did not identify a release-specific DOI. This is a search result, not proof that no DOI exists.
- Targeted internet searches included `WERK lidar Park`, `Kabasares lidar 2025 2026`, `NASA WERK dataset DOI`, `WERK lidar github`, and `nasa-werk PDAL`. [AGU Confex](https://www.bing.com/search?q=%22WERK%22+site%3Aagu.confex.com), [AGU meeting app](https://www.bing.com/search?q=%22WERK%22+%22lidar%22+site%3Astudio.m-anage.com), [EGU abstracts](https://www.bing.com/search?q=%22WERK%22+%22lidar%22+site%3Ameetingorganizer.copernicus.org), [Earthdata](https://www.bing.com/search?q=%22WERK%22+%22lidar%22+site%3Aearthdata.nasa.gov), and [NTRS author search](https://www.bing.com/search?q=%22Kabasares%22+%22lidar%22+site%3Antrs.nasa.gov) produced no usable release-specific methods record. Google text retrieval returned a JavaScript challenge; Bing supplied discovery links. AI-generated search summaries were not treated as sources.

## Remaining Verification For Integration

1. Cover percentage-point encoding is verified in representative windows at both resolutions; validate the full-range quality separately before scientific aggregation. Do not multiply stored cover values by 100.
2. Trace source LAZ campaign vertical CRS and units into DTM/DSM, including any reprojection or vertical transformation. Verify all five 1 m bands per campaign; the published example directly supports CHM metres only.
3. Obtain the production normalization and return-filter expressions for height statistics; establish the denominator and class filters for all six cover layers, including exact threshold inclusivity.
4. Establish the terrain operator and flags to resolve aspect origin/direction, flat marker, and slope scaling. Degrees alone do not justify compass labels.
5. Obtain SD/skewness/kurtosis formulas and quantile options; record Pearson versus excess kurtosis and small-sample handling. Verify acquisition-year encoding and missing-year value separately.

## Cited Primary Sources

[S1]: https://scil-data.sdsc.edu/data/nasa-werk/README
[S2]: https://raw.githubusercontent.com/kylekabasares-nasa/ca-lidar-visualizations/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/statewide-visualization-notebook.ipynb
[S3]: https://raw.githubusercontent.com/kylekabasares-nasa/ca-lidar-visualizations/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/pre-post-LA-fire-visual-chm.ipynb
[S4]: https://raw.githubusercontent.com/kylekabasares-nasa/ca-lidar-visualizations/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/query-stac.ipynb
[S5]: https://www.itl.nist.gov/div898/handbook/eda/section3/eda35b.htm
[S6]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-30m/
[S7]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-10m/
