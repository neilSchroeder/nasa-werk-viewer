# NASA WERK California LiDAR Data — Primary-Source Review

**Research/fetch date:** 2026-10-13 (all HTTP requests below were made on this date; the dataset is actively being updated — several files carry `Last-Modified` dates in 2026, see [Inventory](#1-inventory-and-resolutions)).

**Scope and method:** Every claim in this document was obtained directly from one of: the SDSC `nasa-werk` data root/README/LICENSE/directory listings, the SDSC STAC catalog/collection/item JSON documents, bounded `rasterio`-over-`/vsicurl` GeoTIFF header/pixel probes (no full-file downloads — only IFD/header reads and small windowed pixel reads), the publisher-endorsed `kylekabasares-nasa/ca-lidar-visualizations` GitHub repository pinned at commit [`1016755`](https://github.com/kylekabasares-nasa/ca-lidar-visualizations/commit/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d), the National Data Platform STAC mirror referenced by that repo's `query-stac.ipynb`, the NASA WERK project page, and USGS/NIST reference pages (NIST was unreachable at research time — see [Unresolved §8](#8-unresolved-questions)). The existing repo docs `docs/ingestion-assessment.md` and `docs/variable-units.md` were **not** used as sources of fact; where this review's findings happen to agree with them, it is because both were checked independently against the same primary sources.

**Confidence tiers used throughout:**
- **Verified** — a primary source document/HTTP response was read directly and states the fact.
- **Independently checked** — a bounded probe (GeoTIFF header read, pixel sample, notebook code read) was run and is consistent with (or contradicts) a publisher claim.
- **Inferred** — a reasonable conclusion from verified facts, not directly stated anywhere.
- **Unknown/Unresolved** — not stated by the publisher and not determinable with the tools/time available.

Citation style: inline Markdown links to exact URLs, with reference-style links collected at the bottom for GitHub/notebook citations that need commit SHA + line/cell precision.

---

## 1. Inventory and resolutions

**Verified** (directory listing of [`https://scil-data.sdsc.edu/data/nasa-werk/`][root]): the root directory contains six 1 m campaign folders — `CA_LAPostWildfire_Eaton_C25/`, `CA_LAPostWildfire_Palisades_C25/`, `CA_LosAngeles_1_B23/`, `CA_NoCal_Wildfires_CampFire_2018/`, `CA_SanFrancisco_1_B23/`, `CA_SierraNevada_7_2022/` — plus `statewide-10m/`, `statewide-30m/`, and `stac/` directories, a `README`, a `LICENSE`, two pixel-level `*_campaign_year.tif` rasters (10 m: 78 MB, 30 m: 10 MB), and a 327 MB `WERK-lidar-campaign-spatial-metadata-v1.gpkg` [[root listing][root]]. This matches the README's statement "you can explore six campaigns with 1 meter spatial resolution data products and statewide datasets at 10 meter and 30 meter spatial resolution" [[README][readme]].

**Verified** (file naming, from the README [[README][readme]]):
- 1 m campaign tiles: multi-band COGs named after the source USGS 3DEP `.laz` tile, e.g. `USGS_LPC_CA_SanFrancisco_B23_04200255_topographic_cog_1m.tif` corresponds to source file `USGS_LPC_CA_SanFrancisco_B23_04200255.laz`.
- 10 m/30 m statewide rasters: `california_statewide_<resolution>_<map_type>_epsg3310.tif`, one file per variable (band) — i.e. statewide products are **single-band** files, one per variable, not one multi-band stack.

**Independently checked** (directory listings [`statewide-30m/`][sw30] and [`statewide-10m/`][sw10]):
- `statewide-30m/` contains 21 `*.tif` files matching the README's 21 statewide `map_type` names exactly (dtm, dsm, chm, slope, aspect, sd_first, skewness_first, kurtosis_first, 6× `cc_*`, 7× `p*_first`), each 1.0–1.7 GB, all with `Last-Modified` 2025-12-03 except `dtm`/`dsm`/`slope`/`aspect` (2026-03-21/26) and `chm` (2026-03-21) which were re-published more recently. Two files additionally have 400-byte `.aux.xml` sidecars (`dsm`, `cc_all_2_4`) listed in the index but **both returned HTTP 403 Forbidden** when fetched directly (server blocks direct access to `.aux.xml` even though it appears in the Apache autoindex) [[statewide-30m listing][sw30]].
- `statewide-10m/` contains the same 21 named files (9–15 GB each) **plus an undocumented 35 GB file named `dtm.tif`** that does not follow the `california_statewide_*` naming convention and is not referenced anywhere in the STAC catalog (confirmed absent from `stac/nasa-werk-dem-statewide-10m/collection.json`) [[statewide-10m listing][sw10]]. **Independently checked** via header probe: this orphan `dtm.tif` has identical CRS/extent/shape to the official `california_statewide_10m_dtm_epsg3310.tif` (EPSG:3310, transform `10,0,-374440,0,-10,450020`, 89035×105454) but is **uncompressed, scanline-interleaved, has no overviews** (not a COG), whereas the official file is Zstd-compressed, 512×512-tiled, with 8 overview levels — i.e. it appears to be a leftover raw/uncompressed intermediate render of the DTM, not a published product, and is 2.7× larger on disk as a result.
- 1 m campaign file counts: `CA_SanFrancisco_1_B23/` directory listing shows exactly 651 `.tif` tiles [[SF campaign listing][sfcamp]], matching the STAC collection's 651 `item` links [[sanfrancisco collection.json][sfcoll]] exactly. Individual tile sizes in that listing range from ~5 KB to ~1.1 MB (small tiles are likely edge/mostly-nodata tiles).

**Verified** (CRS, from STAC items, not assumed): statewide 10 m/30 m products use **EPSG:3310** (NAD83 / California Albers) [[30 m dtm item][item-dtm30]]:
```
PROJCS["NAD83 / California Albers", ... PROJECTION["Albers_Conic_Equal_Area"],
PARAMETER["latitude_of_center",0], PARAMETER["longitude_of_center",-120],
PARAMETER["standard_parallel_1",34], PARAMETER["standard_parallel_2",40.5],
PARAMETER["false_easting",0], PARAMETER["false_northing",-4000000], ...
AUTHORITY["EPSG","3310"]]
```
**Independently checked**: `rasterio.open("/vsicurl/.../california_statewide_30m_dtm_epsg3310.tif").crs` reports `EPSG:3310`, matching the STAC item exactly.

1 m campaign tiles use **per-campaign local state-plane-like CRSes**, not a single uniform CRS. **Verified** for the San Francisco campaign item: `EPSG:7131` ("NAD83(2011) / San Francisco CS13", a Transverse Mercator projection centered at `-122.45°`) [[1 m SF item][item-sf1m]]. This means any viewer code that assumes a single CRS for 1 m tiles across campaigns is wrong; each campaign collection should be checked individually. (Not re-verified for all six campaigns — see [§8](#8-unresolved-questions).)

**Independently checked, important grid-mismatch finding:** within the *same* statewide resolution and the *same* CRS, there are **two distinct pixel grids**, not one:
- "Group A" (dtm, dsm, chm, slope, aspect): 30 m extent `[-374430, -604500, 515910, 450000]`, shape `35150 × 29678`.
- "Group B" (sd_first, skewness_first, kurtosis_first, all 6 `cc_*`, all 7 `p*_first`): 30 m extent `[-384330, -613050, 516750, 481560]`, shape `36487 × 30036`.

Group B's bounding box is larger than Group A's on all four sides (by exact multiples of the pixel size — origins differ by 9900 m = 330×30 m west, 8550 m = 285×30 m south, 840 m = 28×30 m east, 31560 m = 1052×30 m north), and the same split holds at 10 m resolution (Group A shape 89035×105454 vs. Group B shape 90107×109458) [[30 m item shape/bbox table — derived by fetching all 21 items; see Appendix][items-appendix]]. This was confirmed both from STAC `proj:shape`/`proj:bbox` fields and independently from `rasterio` header reads of the actual GeoTIFFs (identical results). **Implication for ingestion:** DTM/DSM/CHM/slope/aspect cannot be pixel-stacked with the point-cloud-statistic layers (cc_*, p*_first, sd/skewness/kurtosis_first) without reprojection/clipping to a common grid first — they are not on identical grids despite sharing one EPSG code and nominal resolution.

**Verified** (STAC `datetime` fields, every item checked): `start_datetime: "2013-01-01T00:00:00Z"`, `end_datetime: "2023-01-01T00:00:00Z"`, `datetime: null` for every statewide 10 m/30 m item inspected (dtm, dsm, chm, slope, aspect, cc_first_ge2, skewness_first, kurtosis_first — 8 of 21 spot-checked, all 21 bbox/shape values were pulled programmatically and all used the same date range) [[30 m dtm item][item-dtm30]]. See [§7](#7-metadatagridtemporal-interpretation) for interpretation.

---

## 2. Product definitions

**Verified**, from the README's naming-convention section [[README][readme]] and `PRODUCT_CONFIG` dict in the pinned visualization notebook [[statewide-visualization-notebook.ipynb, cell 0, lines 341–520][nb-config]]:

- **1 m campaign tiles**: 5-band COG per tile, band order (1-indexed) = `1: Digital Terrain Model, 2: Digital Surface Model, 3: Canopy Height Model, 4: Slope, 5: Aspect`. **Independently checked** two ways: (a) the STAC item for the San Francisco tile carries an `eo:bands` array `["Digital Terrain Model","Digital Surface Model","Canopy Height Model","Slope","Aspect"]` in that exact order [[1 m SF item][item-sf1m]]; (b) the `pre-post-LA-fire-visual-chm.ipynb` notebook hard-codes `chm_band=3` (1-indexed) when selecting the CHM band from these same 5-band tiles, consistent with band 3 = CHM [[pre-post-LA-fire-visual-chm.ipynb, cell 0][nb-chm-band]].
- **Statewide 10 m/30 m products**: one file per variable (no multi-band statewide file). 21 named variables total (not counting the two separate pixel-level `campaign_year` rasters, which live outside `statewide-*/` and are **not represented in the STAC catalog at all** — confirmed absent from `stac/nasa-werk-dem-statewide-30m/collection.json` and `.../statewide-10m/collection.json`).
- **DTM** = bare-earth Digital Terrain Model; **DSM** = Digital Surface Model (includes vegetation/structures); **CHM** = Canopy Height Model, and the README's Known Issues section states explicitly that "the Canopy Height Model (CHM) is calculated as DSM minus DTM" [[README, Known Issues][readme]] — this is a **Verified** definition of CHM's derivation, not an assumption.
- **Slope/Aspect**: standard terrain-derivative products computed from the DTM (not separately defined beyond the README's one-line gloss "Slope"/"Aspect"; the geomorphometric algorithm used (e.g., Horn vs. Zevenbergen–Thorne) is **not stated anywhere** — Unknown/Unresolved).
- **sd_first / skewness_first / kurtosis_first**: per-pixel statistics named "Standard Deviation of First Returns", "Skew of First Returns", and "Kurtosis of First Returns" by the README [[README][readme]]. The inputs' height reference, point-count rules, and statistical estimators are not specified. Do not call these normalized-height statistics without production-method evidence.
- **cc_\* (6 variables)**: canopy-cover percentages for first or all returns in height bands described using normalized height (`above 2 m`, `2–4 m`, `4–8 m`) [[README][readme]]. The exact cover denominator, return/class filters, and interval endpoint rules are **Unknown/Unresolved**. Bounded samples support percentage-point encoding; they do not establish the denominator or full-range validity.
- **p10…p99_first**: 10th/25th/50th/75th/90th/95th/99th percentile height products for first returns, in metres per the publisher-linked notebook [[README][readme]][[nb-config]]. Whether their input values are normalized above ground is **Unknown/Unresolved**; the README does not define that processing step.
- **campaign_year**: a per-pixel raster (one each at 10 m and 30 m) that the README describes as identifying "the year the lidar data was collected" for the campaign mosaicked into that pixel [[README, Spatial Metadata section][readme]].

---

## 3. Variable units and semantics (complete table)

All units below are **Verified** directly from the notebook's `PRODUCT_CONFIG` dictionary [[statewide-visualization-notebook.ipynb, cell 0, lines 343–520][nb-config]], which is the only primary source that states units explicitly (the README names the variables but never states units in a machine-readable way beyond "meters" for resolution, so the notebook is the authoritative per-variable unit source). Ranges/dtype are **Independently checked** via `rasterio` header + pixel probes against the actual published rasters (see [§5](#5-filldata-and-invalid-value-evidence) for nodata details).

| Variable | File / band | Units (Verified, notebook) | dtype (Independently checked) | Declared header nodata (Indep. checked) | Observed valid-data range (Indep. checked, 30 m, sampled) |
|---|---|---|---|---|---|
| `dtm` | `california_statewide_*_dtm_epsg3310.tif` | meters (`m`) | float32 | **None (not declared)** | ~2509–2607 m in a central Sierra sample window; statewide range not exhaustively scanned |
| `dsm` | `..._dsm_epsg3310.tif` | meters (`m`) | float32 | **None (not declared)** | not exhaustively scanned (same grid as dtm) |
| `chm` | `..._chm_epsg3310.tif` | meters (`m`) | float32 | **None (not declared)** | 0.63–13.67 m in center sample; **0.0 at many pixels that are actually DTM/DSM nodata** (see §5 — false-zero artifact) |
| `slope` | `..._slope_epsg3310.tif` | degrees (`°`) | float32 | **NaN** (declared) | 0–89.9999 in GDAL `STATISTICS_MAXIMUM`/`MINIMUM` tags; 9.9–51.6° in center sample |
| `aspect` | `..._aspect_epsg3310.tif` | degrees (`°`); observed metadata tags span 0–360, but bearing convention is unresolved | float32 | **NaN** (declared) | `STATISTICS_MAXIMUM`=360, `STATISTICS_MINIMUM`=0 (GDAL tags); note `STATISTICS_MEAN`/`STATISTICS_STDDEV` tags both read literally `"-9999"` — these are placeholder/garbage stats, not real computed statistics (see §5) |
| `sd_first` | `..._sd_first_epsg3310.tif` | meters (`m`), notebook labels it "Standard Deviation (First Returns)" | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `skewness_first` | `..._skewness_first_epsg3310.tif` | dimensionless (notebook: `units: ''`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `kurtosis_first` | `..._kurtosis_first_epsg3310.tif` | dimensionless (notebook: `units: ''`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `cc_all_ge2` | `..._cc_all_ge2_epsg3310.tif` | percent (`%`), 0–100 nominal | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `cc_all_2_4` | `..._cc_all_2_4_epsg3310.tif` | percent (`%`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `cc_all_4_8` | `..._cc_all_4_8_epsg3310.tif` | percent (`%`) | float32 (inferred from sibling files; not separately probed) | inferred -9999.0 | not scanned |
| `cc_first_ge2` | `..._cc_first_ge2_epsg3310.tif` | percent (`%`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `cc_first_2_4` | `..._cc_first_2_4_epsg3310.tif` | percent (`%`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `cc_first_4_8` | `..._cc_first_4_8_epsg3310.tif` | percent (`%`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `p10_first` | `..._p10_first_epsg3310.tif` | meters (`m`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `p25_first` | `..._p25_first_epsg3310.tif` | meters (`m`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `p50_first` | `..._p50_first_epsg3310.tif` | meters (`m`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `p75_first` | `..._p75_first_epsg3310.tif` | meters (`m`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `p90_first` | `..._p90_first_epsg3310.tif` | meters (`m`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `p95_first` | `..._p95_first_epsg3310.tif` | meters (`m`) | float32 (inferred) | inferred -9999.0 | not scanned |
| `p99_first` | `..._p99_first_epsg3310.tif` | meters (`m`) | float32 | **-9999.0** (declared) | not exhaustively scanned |
| `campaign_year` (10 m & 30 m) | `california_statewide_*_epsg3310_campaign_year.tif` | calendar year (integer), not stated as any other unit | int16 | **0** (declared) | sampled `2022` at one interior point (30 m); 0 at edges/ocean |

Rows marked "inferred" for dtype/nodata were not individually re-probed in this pass (all six `cc_*` and all seven `p*_first` files share identical byte-for-byte header construction in the two instances checked of each family — `cc_all_ge2`/`cc_first_ge2` and `p10_first`/`p50_first`/`p99_first` — so the remaining siblings are inferred, not verified, to match). See [§8](#8-unresolved-questions) for the list of un-probed files.

**Independently checked, 1 m campaign tiles** (San Francisco tile `USGS_LPC_CA_SanFrancisco_B23_04200255_topographic_cog_1m.tif`): all 5 bands are float32 **with nodata = -9999.0 declared on every band** — this is a materially different (and more correct) nodata declaration than the statewide DTM/DSM/CHM files, which declare no nodata at all (see §5).

---

## 4. Publisher-described known artifacts and limitations

**Verified**, quoted/paraphrased directly from the README's "KNOWN ISSUES" section [[README][readme]]:

> "Outliers in DSM and CHM: The original USGS 3DEP lidar point clouds may contain non-classified outliers which are unrealistically high points that are labeled as Class 1 (Unclassified Points; Typical 3DEP campaigns classify lidar point clouds as ground and unclassified). During lidar processing workflow, Class 1 points are treated as valid data and are included in the Digital Surface Model (DSM) generation. Since the Canopy Height Model (CHM) is calculated as DSM minus DTM (Digital Terrain Model), these outliers propagate into both the DSM and CHM products, resulting in unrealistically high values in localized areas."

> "Data Voids and DTM Artifacts: The underlying lidar point cloud data may contain spatial data voids or areas with no point returns, particularly over small water bodies such as lakes, ponds, and marshlands where the laser pulse is absorbed or scattered. The Triangulated Irregular Network (TIN) algorithm used to generate the DTM can produce artifacts in these areas of sparse or absent point coverage, resulting in unrealistic interpolated surfaces. Users may observe abrupt elevation changes or anomalous terrain features in and around water bodies or other areas with low point density."

The README also states, generically: "We are aware of certain artifacts and anomalies that may appear in the raster data products due to properties of the underlying lidar point cloud data. We are actively working to address these issues in future releases." [[README][readme]].

**Independently discovered during this review** (not mentioned by the publisher anywhere found):
1. **CHM false-zero-at-nodata artifact** (see §5) — because DTM/DSM declare no header nodata and both use a raw `-9999` sentinel, and CHM = DSM − DTM, a nodata pixel in both inputs produces CHM = (−9999) − (−9999) = **0.0**, which looks like "bare ground, zero canopy height" rather than "no data". Confirmed by direct pixel read at a shared nodata location.
2. **Garbage GDAL statistics tags on slope/aspect**: the slope and aspect 30 m GeoTIFFs carry `STATISTICS_MEAN` and `STATISTICS_STDDEV` tags that are both literally the string `"-9999"`, while `STATISTICS_MINIMUM`/`STATISTICS_MAXIMUM` on the same files are real (0/89.9999 and 0/360 respectively). Any tool trusting embedded GDAL mean/stddev statistics for these two bands will get a nonsense value.
3. **Two non-overlapping internal pixel grids** within the same resolution/CRS folder (see §1) — a layer-stacking artifact, not something the README mentions.
4. **An orphan, non-COG, 35 GB `dtm.tif`** sitting in `statewide-10m/` alongside the official product, not referenced by STAC, and 2.7× the size of the equivalent official file for no apparent reason (see §1).
5. **`.aux.xml` sidecar files return HTTP 403** when fetched directly, despite being listed in the Apache directory index (see §1) — a server configuration quirk, not a data-quality issue, but relevant to anyone trying to harvest embedded statistics.

---

## 5. Fill/nodata and invalid-value evidence

**Independently checked**, summarizing the header probes from §1/§3 and the direct pixel reads:

| Product family | Declared header nodata | Behavior at fill pixels (Indep. checked) |
|---|---|---|
| Statewide DTM, DSM, CHM (both 10 m & 30 m) | **None** — no nodata tag in the GeoTIFF at all | Raw pixel value is `-9999.0` for DTM/DSM at masked locations (confirmed at a top-right/top-left/bottom-left 5×5 corner sample on the 30 m grid, well outside the California landmass); **CHM is `0.0`** at the same locations (see artifact #1 above), not `-9999` |
| Statewide slope, aspect (10 m & 30 m) | **NaN** (declared via the `_FillValue`/nodata tag) | Most masked pixels read as `nan`; a narrow band of pixels at the data edge instead reads `4.071110039794573e-13` (a near-zero floating-point artifact, not exactly 0 or NaN) — likely from slope/aspect being computed over a DTM edge that was effectively flat/zero rather than properly excluded |
| Statewide sd_first, skewness_first, kurtosis_first, all 6 `cc_*`, all 7 `p*_first` | **-9999.0** (declared) | Nodata is both declared in the header and (per family pattern) consistent with the `-9999` sentinel used elsewhere |
| `campaign_year` (10 m & 30 m) | **0** (declared) | Pixels outside any campaign footprint read `0`; a sampled interior pixel read a plausible year value (`2022`) |
| 1 m campaign 5-band tiles | **-9999.0 on every band** (declared) | Confirmed on the San Francisco sample tile; all 5 bands carry the same declared nodata |

**Independently checked** — the pinned visualization notebook's masking heuristic does **not** rely purely on the declared header nodata. Its `mask_nodata()` function [[statewide-visualization-notebook.ipynb, cell 0, lines 556–571][nb-mask]]:

```python
def mask_nodata(data: np.ndarray, nodata: Optional[float] = None) -> np.ndarray:
    """
    Mask NoData and invalid values, returning array with NaN for invalid pixels.
    """
    result = data.astype(np.float64)
    mask = np.zeros(data.shape, dtype=bool)

    if nodata is not None:
        mask |= np.isclose(result, nodata, rtol=1e-5, equal_nan=True)

    mask |= np.isclose(result, -9999, rtol=1e-5)
    mask |= (result < -9000)
    mask |= (result > 4000)
    mask |= np.isnan(result)
    mask |= np.isinf(result)

    result[mask] = np.nan
    return result
```

This masks: the declared nodata value if one was read from the GeoTIFF tag; `-9999` by closeness; anything `< -9000`; anything `> 4000`; NaN; and Inf. The `> 4000` clause is a **visualization convenience, not a physically defensible data rule** for every variable — e.g. 4000 m is a reasonable upper bound for California elevation (Mt. Whitney ≈ 4421 m, so this threshold would actually *clip legitimate high-elevation DTM/DSM values* near the state's highest peaks) but is not a meaningful bound for slope (0–90°), aspect (0–360°), canopy cover percent (0–100), or skewness/kurtosis (unbounded in principle). The separate `pre-post-LA-fire-visual-chm.ipynb` notebook uses a *different, CHM-specific* heuristic instead — `.where(chm > -10).where(chm < 100)` [[pre-post-LA-fire-visual-chm.ipynb, cell 0][nb-chm-mask]] — i.e. the two publisher-endorsed notebooks do not even agree with each other on a single masking rule, and neither notebook's heuristic is declared anywhere as the "correct" cleaning rule for the raw data; they are visualization conveniences.

**Discrepancy to flag explicitly:** for DTM/DSM (no declared header nodata), any ingestion pipeline that trusts GDAL/rasterio's automatic nodata masking (e.g., `rioxarray.open_rasterio(url, masked=True)`, which is exactly what the pinned `query-stac.ipynb` notebook does for 1 m tiles [[query-stac.ipynb, cell 7][nb-query-mask]]) will **silently fail to mask** the `-9999` fill values in the *statewide* DTM/DSM/CHM rasters, because there is no nodata tag to trigger on — this only works correctly for the 1 m campaign tiles and the Group B statewide layers, which do declare `-9999`.

---

## 6. Intended/useful applications and explicit non-uses

**Verified**, from the SDSC README [[README][readme]]: "This dataset provides a uniform and transformative resource for applications spanning wildfire risk modeling, biodiversity monitoring, urban planning, and ecosystem services assessment, offering a new foundation for data-driven environmental stewardship across California's dynamic landscapes."

**Verified**, from the NASA WERK project page [[nasa.gov/werk][nasa-werk]]: the LiDAR release is explicitly framed as the first phase of a broader five-product WERK program (Change Detection and Attribution, Land Cover Classification, Individual Tree Monitoring, Built Structure Mapping, and WERK-Wide Analysis & Assessment), intended to answer "How have California ecosystems changed? Why have they changed? What are the repercussions of these changes? How effective are California's land management practices? What can we do to improve?" and to support "the State's urgent efforts to protect public safety and natural resources amid increasing wildfire risk." It further states the LiDAR products will underpin "novel metrics and insights for wildfire severity," "vegetation management and restoration progression mapping" (including defensible-space and utility/roadway right-of-way tracking), and "tree mortality quantification."

**Verified — explicit non-use / caution statements found:** the README's Known Issues section is itself the closest thing to an explicit non-use warning: it tells users to "be aware of potential outliers in elevation and canopy height data" and to expect "abrupt elevation changes or anomalous terrain features in and around water bodies or other areas with low point density" — i.e., it cautions against treating DSM/CHM maxima or DTM values near water bodies as reliable without further QA [[README][readme]].

**Not found anywhere** despite searching the README, LICENSE, STAC catalog descriptions, and the NASA WERK page: any explicit statement that this is/is not a time-series product, any statement about vertical datum precision suitability for survey-grade work, or any formal "do not use this for X" disclaimer beyond the generic NASA open-data disclaimer link. The README does note "the timing of LiDAR data collection varies among campaigns" immediately after the band/variable listing [[README][readme]] — a soft signal against treating the statewide mosaic as synchronous, but not a hard prohibition. The LICENSE is **Verified** as CC0 1.0 Universal (public domain dedication) [[LICENSE][license]], which disclaims "warranties of title, merchantability, fitness for a particular purpose, non infringement, or the absence of latent or other defects, accuracy, or the present or absence of errors" — a legal disclaimer, not a usage-scope statement.

---

## 7. Metadata/grid/temporal interpretation

**Verified** (STAC extensions declared): every statewide item declares `stac_extensions: ["https://stac-extensions.github.io/projection/v2.0.0/schema.json"]`; every 1 m campaign item additionally declares the `eo` extension (`v1.1.0`) for its `eo:bands` array [[30 m dtm item][item-dtm30]], [[1 m SF item][item-sf1m]].

**Independently checked against raster headers** (not STAC-only): for the 30 m DTM, the STAC item's `proj:transform` is `[30.0, 0.0, -374430.0, 0.0, -30.0, 450000.0, 0.0, 0.0, 1.0]` and `proj:shape` is `[35150, 29678]` (rows, cols); `rasterio` reading the actual GeoTIFF reports `transform = | 30.00, 0.00, -374430.00 | 0.00, -30.00, 450000.00 | 0.00, 0.00, 1.00 |` and `width=29678, height=35150` — an exact match. The same cross-check was repeated for the 30 m CHM, slope, cc_first_ge2, skewness_first, kurtosis_first, and the 10 m DTM; all matched their STAC item's declared transform/shape exactly.

**Temporal interpretation — Verified, and a caution against over-interpreting it:**
- Every statewide item's `datetime` field is `null`, with `start_datetime = 2013-01-01T00:00:00Z` and `end_datetime = 2023-01-01T00:00:00Z` for every statewide layer checked (8 distinct layers spot-checked directly, all 21 30 m item bbox/shape values pulled; the datetime fields were not separately re-verified for all 21 but the two tested families — Group A and Group B — both used identical datetime values). This is a **STAC collection-level time span for the overall campaign mosaic**, not a per-pixel timestamp.
- The **per-pixel** temporal information lives in the separate `campaign_year` rasters (10 m and 30 m), which are not STAC items at all — they are plain files at the data root, described only in README prose ("a 10-meter and 30-meter pixel-level year GeoTIFF which identifies the year the lidar data was collected") [[README][readme]]. **Independently checked**: the 30 m `campaign_year` raster is int16 with declared nodata `0`, and a sampled interior pixel (central Sierra Nevada area, matching the same window sampled for DTM/CHM above) read the value `2022`.
- **Do not treat the statewide mosaic as a single-date snapshot or a time series.** The 2013–2023 span plus per-pixel `campaign_year` values together indicate the statewide rasters are a **spatial mosaic of lidar campaigns flown in different years**, stitched into one raster — not a single acquisition date, and not multiple dated epochs of the same area suitable for change detection without first consulting `campaign_year` pixel-by-pixel. The README's own phrase "the timing of LiDAR data collection varies among campaigns" supports this reading directly [[README][readme]].
- The supplementary `WERM-lidar-campaign-spatial-metadata-v1.gpkg` is described by the README as "a subset of the official USGS 3DEP Work Unit Extent Spatial Metadata (WESM) [that] contains the specific CA 3DEP lidar campaigns that were used to create the current statewide mosaics" [[README][readme]] — this is the authoritative way to identify which named USGS 3DEP campaign underlies any given statewide pixel/region, but its internal schema was **not** inspected in this review (no GDAL/OGR vector-reading tool was available in the sandbox to bound-probe a 327 MB remote GeoPackage safely — see §8).
- 1 m campaign items have **real, non-null point-in-time `datetime`** values: the SF sample tile reports `start_datetime = end_datetime = datetime = "2023-04-20T00:00:00Z"` [[1 m SF item][item-sf1m]], consistent with these being per-flight-line acquisition tiles with a true acquisition date, unlike the statewide mosaics.

**Alternate/duplicate access path — Verified:** the pinned `query-stac.ipynb` notebook does not query `scil-data.sdsc.edu`'s own STAC catalog; it queries a separate aggregator, `https://nationaldataplatform.org/stac`, and filters for collections containing `'nasa-werk'` in the ID [[query-stac.ipynb, cells 0–3][nb-query]]. **Independently checked**: querying that endpoint's `/collections/nasa-werk-dem-ca-losangeles-1-b23/items` with the notebook's example bbox returns items whose `assets.data.href` still points back to `scil-data.sdsc.edu` — i.e. this is a STAC metadata mirror/aggregator over the same underlying files, not an independent copy of the data.

---

## 8. Unresolved questions

- **Unknown/Unresolved** — Exact geomorphometric algorithm used to compute `slope`/`aspect` (e.g., Horn 1981 vs. Zevenbergen–Thorne) from the DTM. Searched README (one-line gloss only), both pinned notebooks (consume slope/aspect as pre-computed bands, no algorithm comment), and the STAC item JSON (no processing-lineage field present). Not resolved.
- **Unknown/Unresolved** — Exact canopy-cover formula (returns-above-threshold ÷ total returns vs. ÷ total pulses; first-pulse-only denominator vs. all-returns denominator) for the six `cc_*` variables. README only names the variables; no notebook computes or re-derives canopy cover from raw points.
- **Unknown/Unresolved** — Whether `skewness_first`/`kurtosis_first` use the common "excess kurtosis" (normal=0) or "Pearson kurtosis" (normal=3) convention, and whether skewness is the Fisher-Pearson or adjusted Fisher-Pearson estimator. Attempted: searched README and both notebooks for a formula or reference; none given. Attempted the NIST/SEMATECH e-Handbook of Statistical Methods page for the standard definitions (`https://www.itl.nist.gov/div898/handbook/eda/section3/eda35b.htm`) as an independent reference for what "skewness"/"kurtosis" conventionally mean — **the NIST site returned HTTP 502 (Bad Gateway) at research time and could not be fetched**, so this document does not assert a NIST-sourced definition; treat any skewness/kurtosis sign/scale assumptions as unverified.
- **Unknown/Unresolved** — Full schema and row count of `WERK-lidar-campaign-spatial-metadata-v1.gpkg` (327 MB GeoPackage). Attempted: no `ogrinfo`/GDAL CLI or Python `osgeo`/`fiona` vector-reading bindings were available in the sandbox (`rasterio` is raster-only), and a GeoPackage is itself an embedded SQLite database that cannot be safely header-probed with a small HTTP byte range the way a COG's IFD can — a correct read requires either downloading the whole file (explicitly disallowed by the task's guardrails) or a tool capable of SQLite-over-HTTP random access, which was not available. Its contents are described only in README prose.
- **Unknown/Unresolved** — Why Group A (dtm/dsm/chm/slope/aspect) and Group B (sd_first/skewness_first/kurtosis_first/cc_*/p*_first) statewide layers use two different, non-aligned bounding boxes. Not explained anywhere in the README, STAC descriptions, or notebooks. Confirmed real (not a fetch artifact) via two independent methods (STAC `proj:*` fields and direct GeoTIFF header reads) at both 10 m and 30 m.
- **Unknown/Unresolved** — Identity/purpose of the orphan `statewide-10m/dtm.tif` (35 GB, non-COG, not in STAC, not in README naming convention). Could not determine from any available metadata whether this is an accidental leftover, a raw pre-COG-conversion intermediate kept for archival reasons, or an alternate "full precision" product; no file carries any explanatory sidecar (its would-be `.aux.xml` was not listed and the directory index shows no corresponding entry).
- **Unknown/Unresolved** — Whether the `nasa-werk-dem-statewide-30m-canopy-percentiles` and `nasa-werk-dem-statewide-10m-canopy-percentiles` STAC collections (linked as children from `catalog.json`) were ever populated; both currently return HTTP 404 when fetched, meaning the root `catalog.json` itself contains two dangling/broken child links. Could not determine if this is a stale catalog or an in-progress reorganization (the directory's `Last-Modified` on `stac/` is 2025-12-09, while several statewide rasters were updated in March 2026, suggesting the STAC catalog may not have been regenerated after the most recent raster republish).
- **Unknown/Unresolved** — Exact CRS used by 1 m tiles in the other five campaigns (Eaton, Palisades, LosAngeles, CampFire, SierraNevada). Only the San Francisco campaign's CRS (`EPSG:7131`) was independently checked; the README does not state a CRS policy for 1 m tiles at all, and it is only an inference (not verified) that each campaign uses whatever local state-plane/UTM zone is appropriate to its geography.
- **Unknown/Unresolved** — Whether the `> 4000` nodata-adjacent threshold in the pinned notebook's `mask_nodata()` (see §5) is a deliberate, dataset-wide "no valid value exceeds 4000" claim by the publisher, or purely an incidental visualization convenience; the notebook contains no comment explaining the choice, and it is in tension with real California topography (Mt. Whitney ≈ 4421 m), so this document treats it as a visualization convenience rather than a validated data bound.

---

## Appendix: all 21 statewide 30 m item shapes/bboxes (Independently checked, from STAC item JSON, cross-checked against raster headers for the 7 named in §1/§7)

```
california_statewide_30m_dtm_epsg3310:          shape=[35150, 29678]  bbox=[-374430.0, -604500.0, 515910.0, 450000.0]   (Group A)
california_statewide_30m_dsm_epsg3310:          shape=[35150, 29678]  bbox=[-374430.0, -604500.0, 515910.0, 450000.0]   (Group A)
california_statewide_30m_chm_epsg3310:          shape=[35150, 29678]  bbox=[-374430.0, -604500.0, 515910.0, 450000.0]   (Group A)
california_statewide_30m_slope_epsg3310:        shape=[35150, 29678]  bbox=[-374430.0, -604500.0, 515910.0, 450000.0]   (Group A)
california_statewide_30m_aspect_epsg3310:       shape=[35150, 29678]  bbox=[-374430.0, -604500.0, 515910.0, 450000.0]   (Group A)
california_statewide_30m_sd_first_epsg3310:     shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]   (Group B)
california_statewide_30m_skewness_first_epsg3310: shape=[36487, 30036] bbox=[-384330.0, -613050.0, 516750.0, 481560.0] (Group B)
california_statewide_30m_kurtosis_first_epsg3310: shape=[36487, 30036] bbox=[-384330.0, -613050.0, 516750.0, 481560.0] (Group B)
california_statewide_30m_cc_all_ge2_epsg3310:   shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_cc_all_2_4_epsg3310:   shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_cc_all_4_8_epsg3310:   shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_cc_first_ge2_epsg3310: shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_cc_first_2_4_epsg3310: shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_cc_first_4_8_epsg3310: shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p10_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p25_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p50_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p75_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p90_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p95_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
california_statewide_30m_p99_first_epsg3310:    shape=[36487, 30036]  bbox=[-384330.0, -613050.0, 516750.0, 481560.0]  (Group B)
```
Source: 21 individual item JSON files fetched from `stac/nasa-werk-dem-statewide-30m/<id>/<id>.json` on 2026-10-13; the equivalent 10 m collection was also fetched in full and shows the identical two-group split (Group A: 89035×105454; Group B: 90107×109458).

---

## References

[root]: https://scil-data.sdsc.edu/data/nasa-werk/ "SDSC nasa-werk data root directory listing"
[readme]: https://scil-data.sdsc.edu/data/nasa-werk/README "NASA WERK California Lidar-Derived Products README"
[license]: https://scil-data.sdsc.edu/data/nasa-werk/LICENSE "CC0 1.0 Universal license text"
[sw30]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-30m/ "statewide-30m directory listing"
[sw10]: https://scil-data.sdsc.edu/data/nasa-werk/statewide-10m/ "statewide-10m directory listing"
[sfcamp]: https://scil-data.sdsc.edu/data/nasa-werk/CA_SanFrancisco_1_B23/ "CA_SanFrancisco_1_B23 campaign directory listing"
[sfcoll]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-ca-sanfrancisco-1-b23/collection.json "STAC collection.json for CA_SanFrancisco_1_B23"
[catalog]: https://scil-data.sdsc.edu/data/nasa-werk/stac/catalog.json "STAC root catalog.json"
[item-dtm30]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-statewide-30m/california_statewide_30m_dtm_epsg3310/california_statewide_30m_dtm_epsg3310.json "STAC item: 30m statewide DTM"
[item-sf1m]: https://scil-data.sdsc.edu/data/nasa-werk/stac/nasa-werk-dem-ca-sanfrancisco-1-b23/usgs_lpc_ca_sanfrancisco_b23_04200255_topographic_cog_1m/usgs_lpc_ca_sanfrancisco_b23_04200255_topographic_cog_1m.json "STAC item: 1m San Francisco campaign tile 04200255"
[items-appendix]: #appendix-all-21-statewide-30-m-item-shapesbboxes-independently-checked-from-stac-item-json-cross-checked-against-raster-headers-for-the-7-named-in-1-7 "Appendix: all 21 statewide 30m item shapes/bboxes"
[nasa-werk]: https://www.nasa.gov/werk/ "NASA WERK project page"
[nb-config]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/statewide-visualization-notebook.ipynb "statewide-visualization-notebook.ipynb at commit 1016755, PRODUCT_CONFIG dict, cell 0 source lines 341-520"
[nb-mask]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/statewide-visualization-notebook.ipynb "statewide-visualization-notebook.ipynb at commit 1016755, mask_nodata() function, cell 0 source line 551"
[nb-chm-band]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/pre-post-LA-fire-visual-chm.ipynb "pre-post-LA-fire-visual-chm.ipynb at commit 1016755, cell 0, load_and_align_chms(chm_band=3)"
[nb-chm-mask]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/pre-post-LA-fire-visual-chm.ipynb "pre-post-LA-fire-visual-chm.ipynb at commit 1016755, cell 0, pre_masked/post_masked .where(x > -10).where(x < 100)"
[nb-query]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/query-stac.ipynb "query-stac.ipynb at commit 1016755, cells 0-3, Client.open('https://nationaldataplatform.org/stac')"
[nb-query-mask]: https://github.com/kylekabasares-nasa/ca-lidar-visualizations/blob/1016755399e9c94f2af7fc4dbd57ddf9c4522f8d/query-stac.ipynb "query-stac.ipynb at commit 1016755, cell 7, rxr.open_rasterio(item.assets['data'].href, masked=True)"
