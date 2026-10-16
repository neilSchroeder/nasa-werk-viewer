# WERK products and units

## Inventory

The [SDSC publisher README](https://scil-data.sdsc.edu/data/nasa-werk/README)
lists six 1 m campaign collections and statewide 10 m and 30 m products.
Campaign rasters are five-band files in the order DTM, DSM, CHM, slope,
aspect. Statewide rasters are one product per file. Their nominal CRS is
EPSG:3310, but the primary-source review found two distinct pixel grids among
statewide products at the same resolution. Same CRS and pixel size do not
guarantee aligned cells. See [grid details](source-review.md).

This browser viewer exposes the 21 named statewide 30 m science layers and
the separate 30 m `campaign_year` raster.

## Unit evidence and scope

The publisher-endorsed statewide visualization notebook explicitly labels
elevation and height products in metres, slope and aspect in degrees, and
cover products in percent. It gives empty unit strings for skewness and
kurtosis; those statistics are dimensionless by definition. Bounded sampling
of all six cover layers found values on a 0–100 percentage-point scale at
both 10 m and 30 m in one Santa Cruz Mountains window. This confirms the
interpretation for those samples, not every cell.

The 30 m GeoTIFF headers inspected did not provide band units, scale/offset
metadata, or a complete semantic specification. The 10 m non-cover products
were not exhaustively checked for physical ranges, and unit labels for the
1 m campaign series must not be generalized from one CHM example.

## Variable dictionary

| Product | Meaning and unit | Use and limits |
|---|---|---|
| `dtm` | Digital Terrain Model (DTM), metres | Broad terrain context. Vertical datum is unresolved. Publisher reports TIN interpolation artifacts where returns are sparse or absent, particularly over water. |
| `dsm` | Digital Surface Model (DSM), metres | Surface elevation including above-ground returns. Unclassified point outliers can produce implausibly high values. |
| `chm` | Canopy Height Model (CHM), metres; publisher says DSM minus DTM | Broad canopy-height pattern exploration. High DSM outliers can propagate. Coincident DTM/DSM fill can yield CHM value `0.0`; the viewer masks it using aligned DTM/DSM validity windows while retaining zero where both source values are valid. |
| `slope` | Slope, degrees | Terrain-steepness exploration. Algorithm, neighborhood, and vertical scaling are undocumented. |
| `aspect` | Aspect, degrees | Directional terrain exploration only after conventions are verified. Zero direction, rotation, north reference, and flat-cell encoding are unresolved; do not assert compass bearings from degrees alone. |
| `sd_first` | Standard deviation of first returns, metres | Cell-level dispersion metric. Input height reference, estimator, and minimum point count are unresolved. |
| `skewness_first` | Skewness of first returns, dimensionless | Exploratory distribution-shape metric. Input height reference and estimator are unresolved. |
| `kurtosis_first` | Kurtosis of first returns, dimensionless | Exploratory tail-shape metric. Pearson versus excess convention and estimator are unresolved. |
| `cc_first_ge2` | First-return canopy-cover percentage above 2 m normalized height | Compare with the same return family and threshold. Percentage-point encoding is sampled and supported; exact denominator and threshold inclusivity are unresolved. |
| `cc_all_ge2` | All-return canopy-cover percentage above 2 m normalized height | “All” and “first” represent different return populations; do not interchange them. Denominator and endpoint convention are unresolved. |
| `cc_first_2_4` | First-return cover percentage in the 2–4 m normalized-height band | Endpoint inclusivity and denominator are unresolved. |
| `cc_all_2_4` | All-return cover percentage in the 2–4 m normalized-height band | Endpoint inclusivity and denominator are unresolved. |
| `cc_first_4_8` | First-return cover percentage in the 4–8 m normalized-height band | Endpoint inclusivity and denominator are unresolved. |
| `cc_all_4_8` | All-return cover percentage in the 4–8 m normalized-height band | Endpoint inclusivity and denominator are unresolved. |
| `p10_first` | 10th percentile of first-return height, metres | Published cell-level metric. Whether values are normalized above ground, and the quantile method, are unresolved. |
| `p25_first` | 25th percentile of first-return height, metres | Same input-reference and quantile caveats as `p10_first`. |
| `p50_first` | 50th percentile of first-return height, metres | Same input-reference and quantile caveats as `p10_first`. |
| `p75_first` | 75th percentile of first-return height, metres | Same input-reference and quantile caveats as `p10_first`. |
| `p90_first` | 90th percentile of first-return height, metres | Same input-reference and quantile caveats as `p10_first`; inspect high values for outlier effects. |
| `p95_first` | 95th percentile of first-return height, metres | Same input-reference and quantile caveats as `p10_first`; inspect high values for outlier effects. |
| `p99_first` | 99th percentile of first-return height, metres | Upper-tail screening only; high values are review candidates, not automatically errors. |
| `campaign_year` | Calendar year of lidar collection | Spatial acquisition provenance. It is not a time series. Header nodata is `0` in the inspected 10 m/30 m assets. |

`first` means first laser return; `all` means all returns in the publisher's
terminology. These names do not fully specify pulse filtering, class
selection, denominator, or the underlying height normalization.

## Do not overstate the methods

The publisher directly documents cover thresholds as **normalized height**.
It does not, in the materials reviewed, specify whether percentile, standard
deviation, skewness, or kurtosis inputs use normalized heights or absolute
elevations. Refer to those simply as first-return height metrics unless the
production method is confirmed.

Likewise:

- Metres do not establish a vertical datum.
- Degrees do not establish aspect's compass convention or slope algorithm.
- Percent does not by itself establish the cover denominator.
- A cell percentile is not a percentile recomputed from all points in an AOI.
- `campaign_year` does not provide repeated measurements for change analysis.

See [source review](source-review.md) for evidence links, metadata scope, and
the unresolved questions.
