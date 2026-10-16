# Using WERK data

## Match resolution to the question

- **30 m statewide**: a first choice for broad California and regional
  pattern exploration. This is the inventory exposed in the browser viewer.
- **10 m statewide**: consider when 30 m is too coarse, after verifying the
  selected layer's extent, grid, nodata, and acquisition coverage.
- **1 m campaigns**: use for local, detailed inspection only where a named
  campaign exists. Preserve campaign identity. Six campaign collections do
  not constitute wall-to-wall or same-date coverage.

Smaller pixels do not automatically mean higher accuracy or uniform
coverage. Confirm that the source meets the geographic and decision needs.

## Use-case starting points

| Question | Candidate layers | Guidance |
|---|---|---|
| Where are broad canopy-height patterns? | `chm`, `p90_first`, `p95_first` | Inspect high outliers and campaign-year boundaries. The viewer masks CHM cells whose aligned DTM/DSM inputs contain nodata or fill; other source defects may remain. |
| How do mapped canopy returns vary by height band? | `cc_first_*`, `cc_all_*` | Compare the same return family, threshold, resolution, and provenance. Do not equate return percentages with geometric canopy area. |
| How does supplied height structure vary by cell? | `sd_first`, `skewness_first`, `kurtosis_first` | Exploratory use only until height input, estimators, and point-count rules are known. |
| What is the terrain context? | `dtm`, `slope`, `aspect` | Inspect water/sparse-return areas. Do not use aspect as compass direction until its convention is verified. |
| Where did lidar campaigns occur in different years? | `campaign_year` | Use to stratify or qualify spatial comparisons, not as a change time series. |
| Is a parcel, road, tree, or structure safe or accurately measured? | No single WERK layer is sufficient | Obtain fit-for-purpose local data and independent validation. |

The SDSC README names wildfire risk modeling, biodiversity monitoring, urban
planning, and ecosystem services as application areas. That broad framing
does not validate every layer for every task in those fields.

## Combining products

Before pixelwise comparison or arithmetic, confirm equal CRS, pixel size,
pixel origin, shape, extent, and validity mask. The statewide products fall
on two different grids at each inspected resolution. CRS and nominal
resolution alone are not enough.

The publisher describes CHM as DSM minus DTM. Reproducing that operation
requires compatible input grids and masks. Do not subtract resampled map
previews and call the result the publisher's CHM.

Choose resampling by variable semantics. Nearest-neighbor preserves discrete
campaign-year values. Aspect is circular, so a direct arithmetic average over
0/360 degrees is misleading. Continuous-variable methods depend on the
analysis. Mark derived products as derived and record the method.

Height percentiles are supplied cell-level rasters. Averaging or resampling
those percentiles does not recover a pooled point-cloud percentile over the
user's AOI.

## Reporting and exports

Record product and code, resolution, geography, campaign-year context, units,
masking rules, resampling, and source provenance. State whether statistics
come from native source cells or a preview.

The current browser export is a nearest-neighbor-resampled display preview in
EPSG:3857, not a native 30 m analytical extract. Its point-click values and
summary metrics refer to preview pixels. Use the native raster and a
documented spatial workflow for analysis-grade results.

Do not claim direct carbon, species, individual-tree condition, validated
canopy area, engineering-grade elevation, or parcel-scale hazard conclusions
from these rasters alone. Those require methods and reference data beyond the
published product descriptions.
