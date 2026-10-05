# WERK California LiDAR Viewer

[Open the viewer](https://neilschroeder.github.io/nasa-werk-viewer/).

A personal project by Neil Schroeder, using NASA WERK's publicly available
California lidar-derived rasters. This is not an official NASA product.

The browser reads remote Cloud-Optimized GeoTIFF windows directly from SDSC.
No Python server, account, or API key is needed to view the GitHub Pages site.
All 21 statewide 30 m science products and the acquisition-year layer are
available, with verified unit labels, regional presets, custom bounds, and
georeferenced preview downloads. No raster datasets are hosted in this repo.

## Local Development

Use Node.js 22:

```bash
npm ci
npm run dev
```

Run tests or serve the production build:

```bash
npm test
npm run build
npm run preview
```

The GitHub Actions workflow tests, builds, and deploys `main` to GitHub Pages.
The repository Pages source is configured as **GitHub Actions**.

## Data Interpretation

Elevation, canopy height, height percentiles, and height standard deviation
are in metres. Slope and aspect are in degrees. Cover is stored as percentage
points, not a 0-1 fraction. Skewness and kurtosis are dimensionless; the year
layer records the calendar year of lidar collection.

The [complete variable dictionary](docs/variable-units.md) cites the publisher's
examples and includes independent cover-scale checks. Units do not resolve the
still-undocumented vertical datum, aspect convention, cover denominator, or
statistical estimators. Do not treat the mosaic as observations from one date.

Source fill values within 0.05 of -9999 are masked. Negative canopy heights are
missing rather than clipped to zero; other signed variables retain negative
values. Positive source outliers remain. Display percentiles are not quality
validation or a correction of the publisher's data.

### Canopy And Overviews

The source canopy overviews are contaminated: coarse values above 200 m were
observed where native cells were below 10 m. The canopy reader therefore uses
image 0, the native 30 m raster, and nearest-neighbor sampling. Other products
use source overview levels when appropriate. The browser inherits overview
georeferencing from the native image.

Native reads are limited to 12 million source pixels on desktop and 3 million
on narrow screens to bound browser memory and download volume. A wide canopy
request shows the basemap with an error instead of using the corrupted
overview. Zoom in or choose a smaller region, then load the extent. A new
request clears the previous overlay and statistics so stale data cannot appear
to describe the new view. Reads can be cancelled; decoding and reprojection run
in a Web Worker.

### Exports

Downloads contain the displayed, nearest-neighbor-resampled Float32 values
in EPSG:3857 with NaN nodata and JSON provenance in the TIFF description.
They are **not native 30 m analysis exports**. Projection, source URL, units,
and masking policy are included. The original NASA rasters remain unchanged.

## Python Original

The original Streamlit implementation is retained in
[python/nasa_werk_viewer.py](python/nasa_werk_viewer.py). Its dependencies are
declared inline for an isolated `uv` environment:

```bash
uv run --script python/nasa_werk_viewer.py --server.port=8506
uv run --script python/nasa_werk_viewer.py --check
```

Python does not run on GitHub Pages. The published site is the browser port.
The [ingestion assessment](docs/ingestion-assessment.md) records the initial
inventory and design questions; subsequent findings are recorded in the unit
dictionary and the source code's regression tests.

## Attribution And Limits

Data: NASA WERK, USGS 3DEP, and SDSC; the publisher distributes it under
[CC0-1.0](https://scil-data.sdsc.edu/data/nasa-werk/LICENSE).
The source [README](https://scil-data.sdsc.edu/data/nasa-werk/README) documents
known DSM/CHM outliers and terrain artifacts around water.
Map tiles: OpenStreetMap contributors. The site depends on source-server
availability, browser CORS access, and HTTP range support.

This viewer is exploratory, not a validated canopy-area, carbon, engineering,
or hazard-analysis product. Source validity problems cannot be repaired by a
map viewer.