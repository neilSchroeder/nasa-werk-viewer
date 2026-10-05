# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "streamlit>=1.45,<2",
#     "streamlit-folium>=0.25,<1",
#     "folium>=0.19,<1",
#     "rasterio>=1.4,<2",
#     "matplotlib>=3.9,<4",
#     "numpy>=2,<3",
# ]
# ///
"""Remote NASA WERK 30 m raster viewer. Run with uv run --script this_file.py."""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.transform import array_bounds, from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, intersection

BASE_URL = "https://scil-data.sdsc.edu/data/nasa-werk"
MAX_EDGE = 1024
MAX_CANOPY_NATIVE_PIXELS = 60_000_000
SOURCE_FILL_VALUE = -9999.0
SOURCE_FILL_TOLERANCE = 0.05
AREAS = {
    "Santa Cruz Mountains": (-122.30, 37.00, -121.85, 37.35),
    "Lake Tahoe": (-120.25, 38.85, -119.85, 39.25),
    "Los Angeles": (-118.70, 33.85, -118.05, 34.40),
    "Camp Fire / Paradise": (-121.80, 39.60, -121.40, 39.90),
    "San Francisco Bay": (-122.65, 37.35, -121.70, 38.10),
    "California": (-124.50, 32.40, -114.10, 42.10),
}
LAYERS = {
    "Canopy height": ("chm", "viridis"),
    "Terrain elevation": ("dtm", "terrain"),
    "Surface elevation": ("dsm", "terrain"),
    "Slope": ("slope", "magma"),
    "Aspect": ("aspect", "twilight"),
    "Canopy cover / first returns above 2 m": ("cc_first_ge2", "YlGn"),
    "Canopy cover / all returns above 2 m": ("cc_all_ge2", "YlGn"),
    "Canopy cover / first returns 2-4 m": ("cc_first_2_4", "YlGn"),
    "Canopy cover / all returns 2-4 m": ("cc_all_2_4", "YlGn"),
    "Canopy cover / first returns 4-8 m": ("cc_first_4_8", "YlGn"),
    "Canopy cover / all returns 4-8 m": ("cc_all_4_8", "YlGn"),
    **{
        f"First-return height / P{percentile}": (f"p{percentile}_first", "viridis")
        for percentile in (10, 25, 50, 75, 90, 95, 99)
    },
    "First-return height / standard deviation": ("sd_first", "cividis"),
    "First-return height / skewness": ("skewness_first", "coolwarm"),
    "First-return height / kurtosis": ("kurtosis_first", "magma"),
    "Acquisition year": ("campaign_year", "tab20"),
}


def layer_url(code: str) -> str:
    """Resolve only explicitly supported source products."""
    if code not in {value[0] for value in LAYERS.values()}:
        raise ValueError("Unknown WERK layer.")
    if code == "campaign_year":
        return f"{BASE_URL}/california_statewide_30m_epsg3310_campaign_year.tif"
    return f"{BASE_URL}/statewide-30m/california_statewide_30m_{code}_epsg3310.tif"


@dataclass
class Preview:
    """A bounded, nearest-neighbor Web Mercator preview with source metadata."""

    values: np.ndarray
    bounds: tuple[float, float, float, float]
    transform: rasterio.Affine
    source: str
    source_crs: str
    units: str | None
    source_nodata: float | None
    minimum_valid_value: float | None = None
    use_source_overviews: bool = True


def validate_bounds(bounds: tuple[float, float, float, float]) -> None:
    """Validate a west, south, east, north bounding box around California."""
    west, south, east, north = bounds
    if not all(np.isfinite(bounds)):
        raise ValueError("Bounds must be finite numbers.")
    if not (-126 <= west < east <= -113 and 31 <= south < north <= 43):
        raise ValueError("Use ordered bounds within 126-113 W and 31-43 N.")


def bounded_shape(width: float, height: float, max_edge: int) -> tuple[int, int]:
    """Keep an image's aspect ratio while bounding both dimensions."""
    if width <= 0 or height <= 0 or not 32 <= max_edge <= MAX_EDGE:
        raise ValueError("Invalid extent or preview size.")
    scale = min(1.0, max_edge / max(width, height))
    return max(1, round(height * scale)), max(1, round(width * scale))


def read_preview(
    source: str,
    bounds: tuple[float, float, float, float],
    max_edge: int = 768,
    minimum_valid_value: float | None = None,
    use_source_overviews: bool = True,
) -> Preview:
    """Read a decimated native-grid window, then warp only that small array."""
    validate_bounds(bounds)
    if not 32 <= max_edge <= MAX_EDGE:
        raise ValueError(f"Preview size must be between 32 and {MAX_EDGE}.")
    destination_bounds = transform_bounds("EPSG:4326", "EPSG:3857", *bounds)
    with (
        rasterio.Env(
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
            GDAL_HTTP_TIMEOUT="25",
            GDAL_HTTP_CONNECTTIMEOUT="10",
            GDAL_HTTP_MAX_RETRY="1",
            GDAL_CACHEMAX=32 * 1024 * 1024,
            VSI_CACHE=False,
        ),
        rasterio.open(
            source, **({} if use_source_overviews else {"OVERVIEW_LEVEL": "NONE"})
        ) as dataset,
    ):
        if dataset.crs is None:
            raise ValueError("The source raster has no coordinate reference system.")
        native_bounds = transform_bounds("EPSG:4326", dataset.crs, *bounds)
        try:
            window = intersection(
                dataset.window(*native_bounds),
                Window(0, 0, dataset.width, dataset.height),
            )
        except rasterio.errors.WindowError as error:
            raise ValueError(
                "This extent does not overlap the source raster."
            ) from error
        if (
            not use_source_overviews
            and window.width * window.height > MAX_CANOPY_NATIVE_PIXELS
        ):
            raise ValueError(
                "Zoom in for canopy height: the source overviews contain artifacts, "
                "and this extent exceeds the safe native-resolution read limit."
            )
        shape = bounded_shape(window.width, window.height, max_edge)
        native = dataset.read(
            1,
            window=window,
            out_shape=shape,
            masked=True,
            out_dtype="float32",
            resampling=Resampling.nearest,
        ).filled(np.nan)
        native[
            np.isclose(native, SOURCE_FILL_VALUE, rtol=0.0, atol=SOURCE_FILL_TOLERANCE)
        ] = np.nan
        if minimum_valid_value is not None:
            native[native < minimum_valid_value] = np.nan
        native_transform = dataset.window_transform(window) * rasterio.Affine.scale(
            window.width / shape[1], window.height / shape[0]
        )
        west, south, east, north = destination_bounds
        output_shape = bounded_shape(east - west, north - south, max_edge)
        output_transform = from_bounds(
            *destination_bounds, output_shape[1], output_shape[0]
        )
        output = np.full(output_shape, np.nan, dtype="float32")
        reproject(
            source=native,
            destination=output,
            src_transform=native_transform,
            src_crs=dataset.crs,
            src_nodata=np.nan,
            dst_transform=output_transform,
            dst_crs="EPSG:3857",
            dst_nodata=np.nan,
            resampling=Resampling.nearest,
        )
        return Preview(
            output,
            bounds,
            output_transform,
            source,
            dataset.crs.to_string(),
            dataset.units[0],
            dataset.nodata,
            minimum_valid_value,
            use_source_overviews,
        )


def export_preview(preview: Preview, label: str) -> bytes:
    """Export the unstyled preview values, not the rendered color image."""
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            width=preview.values.shape[1],
            height=preview.values.shape[0],
            count=1,
            dtype="float32",
            crs="EPSG:3857",
            transform=preview.transform,
            nodata=np.nan,
            compress="deflate",
        ) as dataset:
            dataset.write(preview.values, 1)
            dataset.set_band_description(1, label)
            if preview.units:
                dataset.set_band_unit(1, preview.units)
            if preview.minimum_valid_value is not None:
                dataset.update_tags(
                    minimum_valid_value=str(preview.minimum_valid_value)
                )
            dataset.update_tags(
                source_url=preview.source,
                source_crs=preview.source_crs,
                source_resolution="30 m",
                processing="Decimated window; nearest-neighbor reprojection",
                source_fill_mask=str(SOURCE_FILL_VALUE),
                source_fill_tolerance=str(SOURCE_FILL_TOLERANCE),
                source_overviews=str(preview.use_source_overviews),
                product="Resampled display preview; not a native 30 m analysis export",
            )
        return memory.read()


def colorize(values: np.ndarray, palette: str, robust: bool, categorical: bool = False):
    """Return transparent RGBA pixels and an unambiguous display normalization."""
    from matplotlib import colormaps
    from matplotlib.colors import BoundaryNorm, Normalize

    finite = values[np.isfinite(values)]
    if not finite.size:
        raise ValueError("No valid lidar pixels in this extent. Choose another area.")
    if categorical:
        categories = np.unique(finite)
        boundaries = np.concatenate((categories - 0.5, [categories[-1] + 0.5]))
        color_map = colormaps[palette].resampled(len(categories))
        normalization = BoundaryNorm(boundaries, color_map.N)
        ticks = categories
    else:
        lower, upper = (
            np.percentile(finite, (2, 98)) if robust else (finite.min(), finite.max())
        )
        if lower == upper:
            lower, upper = float(lower) - 0.5, float(upper) + 0.5
        normalization = Normalize(float(lower), float(upper), clip=True)
        color_map = colormaps[palette]
        ticks = None
    rgba = color_map(normalization(np.nan_to_num(values)), bytes=True)
    rgba[~np.isfinite(values), 3] = 0
    return rgba, color_map, normalization, ticks


def legend_png(color_map, normalization, ticks, label: str) -> bytes:
    """Render a compact legend independently of the Leaflet map."""
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.colorbar import ColorbarBase
    from matplotlib.figure import Figure

    figure = Figure(figsize=(6, 0.8), dpi=120, facecolor="white")
    axes = figure.add_axes((0.04, 0.55, 0.92, 0.24))
    colorbar = ColorbarBase(
        axes, cmap=color_map, norm=normalization, orientation="horizontal", ticks=ticks
    )
    colorbar.set_label(label, fontsize=9)
    axes.tick_params(labelsize=8)
    buffer = BytesIO()
    FigureCanvasAgg(figure).print_png(buffer)
    return buffer.getvalue()


def sample_preview(preview: Preview, longitude: float, latitude: float) -> float | None:
    """Sample a displayed preview pixel, not a native 30 m cell."""
    from rasterio.warp import transform

    eastings, northings = transform("EPSG:4326", "EPSG:3857", [longitude], [latitude])
    column, row = ~preview.transform * (eastings[0], northings[0])
    if not (
        0 <= row < preview.values.shape[0] and 0 <= column < preview.values.shape[1]
    ):
        return None
    value = float(preview.values[int(row), int(column)])
    return value if np.isfinite(value) else None


def main() -> None:
    """Run the Streamlit viewer."""
    import folium
    import streamlit as st
    from streamlit_folium import st_folium

    st.set_page_config(
        page_title="NASA WERK / California lidar",
        page_icon=":material/landscape:",
        layout="wide",
    )
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        html, body, [data-testid="stApp"] {font-family:'IBM Plex Sans',sans-serif;}
        [data-testid="stApp"] {background:#ffffff;color:#192923;}
        [data-testid="stSidebar"] {background:#f2f5f4;border-right:1px solid #dce4df;}
        .block-container {padding-top:2rem;padding-bottom:1.5rem;max-width:1600px;}
        h1 {font-family:'IBM Plex Sans',sans-serif!important;font-size:2rem!important;letter-spacing:0!important;}
        [data-testid="stMetricValue"] {font-size:1.3rem;}
        iframe {border-radius:4px;}
        </style>
    """,
        unsafe_allow_html=True,
    )
    cached_read = st.cache_data(ttl=3600, max_entries=12, show_spinner=False)(
        read_preview
    )
    st.title("NASA WERK")
    st.caption("California lidar / 30 m source rasters")

    with st.sidebar:
        st.subheader("Layers")
        label = st.selectbox("Product", list(LAYERS))
        area = st.selectbox("Area", [*AREAS, "Custom bounds"])
        if st.session_state.get("area_name") != area:
            st.session_state["area_name"] = area
            if area in AREAS:
                st.session_state["bounds"] = AREAS[area]
        st.session_state.setdefault("bounds", AREAS["Santa Cruz Mountains"])
        if area == "Custom bounds":
            with st.form("custom_extent"):
                west = st.number_input(
                    "West longitude",
                    value=-122.30,
                    min_value=-126.0,
                    max_value=-113.0,
                    format="%.4f",
                )
                south = st.number_input(
                    "South latitude",
                    value=37.00,
                    min_value=31.0,
                    max_value=43.0,
                    format="%.4f",
                )
                east = st.number_input(
                    "East longitude",
                    value=-121.85,
                    min_value=-126.0,
                    max_value=-113.0,
                    format="%.4f",
                )
                north = st.number_input(
                    "North latitude",
                    value=37.35,
                    min_value=31.0,
                    max_value=43.0,
                    format="%.4f",
                )
                if st.form_submit_button(
                    "Load area", icon=":material/refresh:", use_container_width=True
                ):
                    candidate = (west, south, east, north)
                    try:
                        validate_bounds(candidate)
                        st.session_state["bounds"] = candidate
                    except ValueError as error:
                        st.error(str(error))
        st.divider()
        st.subheader("Display")
        max_edge = st.select_slider(
            "Preview pixels / longest edge", options=[256, 512, 768, 1024], value=768
        )
        opacity = st.slider("Layer opacity", 0.0, 1.0, 0.85, step=0.05)
        stretch = st.radio(
            "Color range", ["2-98 percentile", "Full range"], horizontal=True
        )
        basemap = st.selectbox("Basemap", ["OpenStreetMap", "None"])
        st.link_button(
            "Source README", f"{BASE_URL}/README", icon=":material/open_in_new:"
        )

    if st.button(
        "Load map extent",
        icon=":material/crop:",
        disabled=not st.session_state.get("map_bounds"),
    ):
        try:
            validate_bounds(st.session_state["map_bounds"])
            st.session_state["bounds"] = st.session_state["map_bounds"]
        except ValueError as error:
            st.error(str(error))
    bounds = st.session_state["bounds"]
    code, palette = LAYERS[label]
    preview = None
    with st.spinner("Reading WERK raster window..."):
        try:
            preview = cached_read(
                layer_url(code),
                bounds,
                max_edge,
                minimum_valid_value=0.0 if code == "chm" else None,
                use_source_overviews=code != "chm",
            )
            rgba, color_map, normalization, ticks = colorize(
                preview.values,
                palette,
                stretch == "2-98 percentile",
                code == "campaign_year",
            )
        except (rasterio.errors.RasterioError, ValueError) as error:
            preview = None
            st.error(f"Could not load {label}: {error}")
            st.link_button("Source raster", layer_url(code))
            if st.button("Retry", icon=":material/refresh:"):
                st.rerun()

    st.subheader(label)
    west, south, east, north = bounds
    map_view = folium.Map(
        location=[(south + north) / 2, (west + east) / 2],
        tiles=None if basemap == "None" else basemap,
        control_scale=True,
        prefer_canvas=True,
        max_zoom=18,
    )
    if preview is not None:
        folium.raster_layers.ImageOverlay(
            rgba,
            bounds=[[south, west], [north, east]],
            name=label,
            opacity=opacity,
            pixelated=True,
            mercator_project=False,
        ).add_to(map_view)
    map_view.fit_bounds([[south, west], [north, east]])
    interaction = st_folium(
        map_view,
        height=560,
        use_container_width=True,
        returned_objects=["bounds", "last_clicked"],
        return_on_hover=False,
        key=f"werk-map-{bounds}",
    )
    viewport = interaction.get("bounds")
    if viewport and viewport.get("_southWest") and viewport.get("_northEast"):
        southwest, northeast = viewport["_southWest"], viewport["_northEast"]
        st.session_state["map_bounds"] = (
            southwest["lng"],
            southwest["lat"],
            northeast["lng"],
            northeast["lat"],
        )
    if preview is None:
        st.stop()

    units = (
        "Year"
        if code == "campaign_year"
        else preview.units
        or ("Height (m)" if code == "chm" else "Source units (unverified)")
    )
    st.image(legend_png(color_map, normalization, ticks, units), width=600)
    finite = preview.values[np.isfinite(preview.values)]
    coverage, median, samples = st.columns(3)
    coverage.metric("Finite preview pixels", f"{finite.size / preview.values.size:.0%}")
    median.metric("Preview median", f"{np.median(finite):,.2f}")
    samples.metric(
        "Preview dimensions", f"{preview.values.shape[1]} x {preview.values.shape[0]}"
    )
    clicked = interaction.get("last_clicked")
    if clicked:
        value = sample_preview(preview, clicked["lng"], clicked["lat"])
        formatted = "No data" if value is None else f"{value:,.3f} / {units}"
        st.caption(
            f"Preview sample at {clicked['lat']:.5f}, {clicked['lng']:.5f}: {formatted}"
        )
    st.download_button(
        "Download preview GeoTIFF",
        export_preview(preview, label),
        file_name=f"werk_30m_{code}_resampled_preview.tif",
        mime="image/tiff",
        icon=":material/download:",
        on_click="ignore",
    )
    with st.expander("Source and quality"):
        st.markdown(f"[NASA WERK / SDSC source raster]({preview.source}) / CC0-1.0")
        st.write(f"Source CRS: {preview.source_crs}. Preview/export CRS: EPSG:3857.")
        st.write(f"Bounding box: {west:.4f}, {south:.4f}, {east:.4f}, {north:.4f}.")
        st.write(
            "Statistics and downloads describe a nearest-neighbor, resampled preview, not a native-resolution regional analysis."
        )
        st.write(
            "Survey dates vary by campaign. Acquisition year is a separate source layer, not a time series."
        )
        st.write(
            "Publisher warnings: high DSM/canopy outliers and terrain interpolation artifacts near water. Positive outliers remain unfiltered."
        )
        if preview.minimum_valid_value is not None:
            st.write(
                "Negative canopy heights are masked as invalid, not replaced with zero. Zero heights remain valid; other layers retain negative values."
            )
        if not preview.use_source_overviews:
            st.write(
                "Canopy previews bypass artifact-contaminated source overviews and sample the native 30 m raster. Large extents are limited to avoid bulk downloads."
            )
        st.write(
            "Units, vertical datum, and cover scaling are not inferred when source metadata is absent."
        )
        st.write(
            f"Source fill values within {SOURCE_FILL_TOLERANCE} of -9999 are masked before reprojection, statistics, and export."
        )
        if preview.source_nodata is None:
            st.warning(
                "The source declares no nodata value. The explicit -9999 mask is applied, but other artifacts may remain; finite pixels are not quality-validated coverage."
            )


def self_check() -> None:
    """Exercise bounded reads, nodata, reprojection, and export without network."""
    from unittest.mock import patch

    bounds = (-122.2, 37.0, -122.0, 37.2)
    native_bounds = transform_bounds("EPSG:4326", "EPSG:3310", *bounds)
    values = np.full((100, 100), 42, dtype="float32")
    values[:40, :40] = SOURCE_FILL_VALUE
    values[20:40, :40] += np.linspace(-0.02, 0.02, 40, dtype="float32")
    values[40:60, :40] = 0
    values[60:, 60:] = -12345
    for declared_nodata in (None, SOURCE_FILL_VALUE):
        with MemoryFile() as memory:
            with memory.open(
                driver="GTiff",
                width=100,
                height=100,
                count=1,
                dtype="float32",
                crs="EPSG:3310",
                transform=from_bounds(*native_bounds, 100, 100),
                nodata=declared_nodata,
            ) as dataset:
                dataset.write(values, 1)
            preview = read_preview(memory.name, bounds, max_edge=64)
            canopy = read_preview(
                memory.name, bounds, max_edge=64, minimum_valid_value=0.0
            )
        assert max(preview.values.shape) <= 64
        assert np.isnan(preview.values).any()
        assert not (preview.values == SOURCE_FILL_VALUE).any()
        assert set(np.unique(preview.values[np.isfinite(preview.values)])) == {
            0,
            42,
            -12345,
        }
        assert set(np.unique(canopy.values[np.isfinite(canopy.values)])) == {0, 42}
    rgba, _, _, _ = colorize(preview.values, "viridis", True)
    assert (rgba[np.isnan(preview.values), 3] == 0).all()
    canopy_rgba, _, canopy_norm, _ = colorize(canopy.values, "viridis", True)
    assert canopy_norm.vmin >= 0
    assert (canopy_rgba[~np.isfinite(canopy.values), 3] == 0).all()
    assert sample_preview(preview, -125, 42) is None
    assert len(LAYERS) == 22
    assert layer_url("campaign_year").endswith("30m_epsg3310_campaign_year.tif")
    year_values = np.array([[2018, 2023], [np.nan, 2020]], dtype="float32")
    year_rgba, _, _, year_ticks = colorize(year_values, "tab20", False, True)
    assert year_rgba[1, 0, 3] == 0
    assert np.array_equal(year_ticks, [2018, 2020, 2023])
    overview_values = np.full((128, 128), 10, dtype="float32")
    overview_values[::2, ::2] = 1000
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            width=128,
            height=128,
            count=1,
            dtype="float32",
            crs="EPSG:3857",
            transform=from_bounds(
                *transform_bounds("EPSG:4326", "EPSG:3857", *bounds), 128, 128
            ),
        ) as dataset:
            dataset.write(overview_values, 1)
            dataset.build_overviews([2], Resampling.average)
        contaminated = read_preview(memory.name, bounds, 64)
        clean = read_preview(memory.name, bounds, 64, use_source_overviews=False)
        with patch.dict(globals(), {"MAX_CANOPY_NATIVE_PIXELS": 1}):
            try:
                read_preview(memory.name, bounds, 64, use_source_overviews=False)
            except ValueError as error:
                assert "safe native-resolution read limit" in str(error)
            else:
                raise AssertionError("The native-read size limit was not enforced")
    assert np.nanmedian(contaminated.values) > 200
    assert np.nanmax(clean.values) == 10
    with (
        MemoryFile(export_preview(clean, "Native canopy check")) as memory,
        memory.open() as dataset,
    ):
        assert dataset.tags()["source_overviews"] == "False"
    with (
        MemoryFile(export_preview(preview, "Synthetic check")) as memory,
        memory.open() as dataset,
    ):
        assert dataset.crs.to_epsg() == 3857
        assert dataset.shape == preview.values.shape
        assert np.array_equal(dataset.read(1), preview.values, equal_nan=True)
        assert dataset.tags()["source_fill_mask"] == str(SOURCE_FILL_VALUE)
        assert dataset.tags()["source_fill_tolerance"] == str(SOURCE_FILL_TOLERANCE)
        assert np.allclose(
            array_bounds(*dataset.shape, dataset.transform),
            transform_bounds("EPSG:4326", "EPSG:3857", *bounds),
        )
    for invalid in [(-122, 37, -123, 38), (-122, 38, -121, 37)]:
        try:
            validate_bounds(invalid)
        except ValueError:
            continue
        raise AssertionError("Invalid bounds were accepted")
    with (
        MemoryFile(export_preview(canopy, "Canopy validity check")) as memory,
        memory.open() as dataset,
    ):
        assert dataset.tags()["minimum_valid_value"] == "0.0"
        assert np.array_equal(dataset.read(1), canopy.values, equal_nan=True)
    print(
        "PASS: bounded read, nodata, reprojection, export, color mapping, years, and input validation"
    )


def probe() -> None:
    """Check a small live WERK canopy-height window."""
    preview = read_preview(
        layer_url("chm"),
        AREAS["Santa Cruz Mountains"],
        256,
        minimum_valid_value=0.0,
        use_source_overviews=False,
    )
    finite = preview.values[np.isfinite(preview.values)]
    assert finite.size > 0, "Live WERK preview has no finite pixels"
    assert finite.min() >= 0, "Live canopy preview contains negative heights"
    print(
        f"Live WERK: {preview.values.shape}, {preview.source_crs}, "
        f"units={preview.units!r}, nodata={preview.source_nodata!r}, "
        f"finite={finite.size}, range={finite.min()}..{finite.max()}"
    )


if __name__ == "__main__":
    if "--check" in sys.argv:
        self_check()
    elif "--probe" in sys.argv:
        probe()
    else:
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        if get_script_run_ctx(suppress_warning=True) is None:
            raise SystemExit(
                subprocess.call(
                    [
                        sys.executable,
                        "-m",
                        "streamlit",
                        "run",
                        str(Path(__file__).resolve()),
                        "--server.address=127.0.0.1",
                        "--server.headless=true",
                        "--browser.gatherUsageStats=false",
                        "--theme.base=light",
                        "--theme.primaryColor=#26715b",
                        *sys.argv[1:],
                    ]
                )
            )
        main()
