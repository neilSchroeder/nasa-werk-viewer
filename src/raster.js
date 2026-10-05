import { fromUrl, writeArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

export const BASE_URL = 'https://scil-data.sdsc.edu/data/nasa-werk';
export const AREAS = {
  'Santa Cruz Mountains': [-122.30, 37.00, -121.85, 37.35],
  'Lake Tahoe': [-120.25, 38.85, -119.85, 39.25],
  'Los Angeles': [-118.70, 33.85, -118.05, 34.40],
  'Camp Fire / Paradise': [-121.80, 39.60, -121.40, 39.90],
  'San Francisco Bay': [-122.65, 37.35, -121.70, 38.10],
  California: [-124.50, 32.40, -114.10, 42.10],
};
export const LAYERS = [
  ['chm', 'Canopy height', 'm', 'viridis'],
  ['dtm', 'Terrain elevation', 'm', 'terrain'],
  ['dsm', 'Surface elevation', 'm', 'terrain'],
  ['slope', 'Slope', 'degrees', 'magma'],
  ['aspect', 'Aspect', 'degrees', 'cyclic'],
  ...['first', 'all'].flatMap((returns) => [
    [`cc_${returns}_ge2`, `Cover / ${returns} returns above 2 m`, '%', 'cover'],
    [`cc_${returns}_2_4`, `Cover / ${returns} returns 2-4 m`, '%', 'cover'],
    [`cc_${returns}_4_8`, `Cover / ${returns} returns 4-8 m`, '%', 'cover'],
  ]),
  ...[10, 25, 50, 75, 90, 95, 99].map((percentile) =>
    [`p${percentile}_first`, `First-return height / P${percentile}`, 'm', 'viridis']),
  ['sd_first', 'First-return height / standard deviation', 'm', 'viridis'],
  ['skewness_first', 'First-return height / skewness', 'dimensionless', 'diverging'],
  ['kurtosis_first', 'First-return height / kurtosis', 'dimensionless', 'magma'],
  ['campaign_year', 'Acquisition year', 'year', 'years'],
].map(([code, label, units, palette]) => ({ code, label, units, palette }));

proj4.defs('EPSG:3310', '+proj=aea +lat_1=34 +lat_2=40.5 +lat_0=0 +lon_0=-120 +x_0=0 +y_0=-4000000 +datum=NAD83 +units=m +no_defs');
const geographicToNative = proj4('EPSG:4326', 'EPSG:3310');
const geographicToMercator = proj4('EPSG:4326', 'EPSG:3857');
const mercatorToNative = proj4('EPSG:3857', 'EPSG:3310');

export function sourceUrl(code) {
  if (!LAYERS.some((layer) => layer.code === code)) throw new Error('Unknown layer.');
  return code === 'campaign_year'
    ? `${BASE_URL}/california_statewide_30m_epsg3310_campaign_year.tif`
    : `${BASE_URL}/statewide-30m/california_statewide_30m_${code}_epsg3310.tif`;
}

export function validateBounds(bounds) {
  const [west, south, east, north] = bounds;
  if (bounds.length !== 4 || !bounds.every(Number.isFinite)
      || !(west >= -126 && east <= -113 && west < east && south >= 31 && north <= 43 && south < north)) {
    throw new Error('Use ordered bounds within 126-113 W and 31-43 N.');
  }
}

export function cleanValue(value, code, nodata = null) {
  if (!Number.isFinite(value) || (nodata !== null && value === nodata)
      || Math.abs(value + 9999) <= 0.05 || (code === 'chm' && value < 0)) return NaN;
  return value;
}

export function projectedBounds(bounds, projection = geographicToNative) {
  const [west, south, east, north] = bounds;
  const points = [];
  for (let step = 0; step <= 20; step += 1) {
    const longitude = west + (east - west) * step / 20;
    const latitude = south + (north - south) * step / 20;
    points.push(projection.forward([longitude, south]), projection.forward([longitude, north]),
      projection.forward([west, latitude]), projection.forward([east, latitude]));
  }
  return [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1]))];
}

function imageWindow(image, bounds, origin = image.getOrigin(), resolution = image.getResolution()) {
  const [west, south, east, north] = bounds;
  const [originX, originY] = origin;
  const [resolutionX, resolutionY] = resolution;
  const columns = [(west - originX) / resolutionX, (east - originX) / resolutionX];
  const rows = [(south - originY) / resolutionY, (north - originY) / resolutionY];
  return [Math.max(0, Math.floor(Math.min(...columns))), Math.max(0, Math.floor(Math.min(...rows))),
    Math.min(image.getWidth(), Math.ceil(Math.max(...columns))), Math.min(image.getHeight(), Math.ceil(Math.max(...rows)))];
}

export function statistics(values) {
  const valid = Array.from(values).filter(Number.isFinite).sort((left, right) => left - right);
  if (!valid.length) throw new Error('No valid lidar pixels in this extent. Choose another area.');
  const percentile = (fraction) => {
    const position = (valid.length - 1) * fraction;
    const lower = Math.floor(position);
    return valid[lower] + (valid[Math.ceil(position)] - valid[lower]) * (position - lower);
  };
  return { count: valid.length, coverage: valid.length / values.length, median: percentile(0.5),
    min: valid[0], max: valid.at(-1), lower: percentile(0.02), upper: percentile(0.98),
    categories: valid.length && new Set(valid).size < 100 ? [...new Set(valid)] : null };
}

export async function exportPreview(preview) {
  const layer = LAYERS.find((item) => item.code === preview.code);
  const [left, bottom, right, top] = preview.mercatorBounds;
  return writeArrayBuffer(preview.values, {
    width: preview.width, height: preview.height,
    BitsPerSample: [32], SampleFormat: [3], SamplesPerPixel: 1,
    PhotometricInterpretation: 1, Compression: 1,
    ModelPixelScale: [(right - left) / preview.width, (top - bottom) / preview.height, 0],
    ModelTiepoint: [0, 0, 0, left, top, 0],
    GTModelTypeGeoKey: 1, GTRasterTypeGeoKey: 1, ProjectedCSTypeGeoKey: 3857,
    GDAL_NODATA: 'nan',
    ImageDescription: JSON.stringify({ product: layer.label, units: layer.units, source: preview.source,
      source_resolution: '30 m', source_crs: 'EPSG:3310',
      processing: 'Nearest-neighbor resampled Web Mercator preview; not a native 30 m analysis export',
      source_overviews: !preview.native, fill_mask: '-9999 +/- 0.05',
      minimum_valid_value: preview.code === 'chm' ? 0 : null }),
  });
}

export async function readPreview({ code, bounds, edge = 768, signal, nativeBudget = 12_000_000, onProgress = () => {} }) {
  validateBounds(bounds);
  if (![256, 512, 768, 1024].includes(edge)) throw new Error('Unsupported preview size.');
  onProgress('Reading raster metadata');
  const tiff = await fromUrl(sourceUrl(code), { allowFullFile: false, blockSize: 65536, cacheSize: 20 }, signal);
  try {
    let image = await tiff.getImage(0);
    const referenceImage = image;
    const origin = referenceImage.getOrigin();
    const referenceResolution = referenceImage.getResolution();
    if (image.getGeoKeys().ProjectedCSTypeGeoKey !== 3310) throw new Error('Unexpected source CRS; expected EPSG:3310.');
    const nativeBounds = projectedBounds(bounds);
    let window = imageWindow(image, nativeBounds);
    const nativePixels = (window[2] - window[0]) * (window[3] - window[1]);
    if (window[2] <= window[0] || window[3] <= window[1]) throw new Error('The extent does not overlap this raster.');
    if (code === 'chm' && nativePixels > nativeBudget) {
      throw new Error(`Zoom in for canopy height: this area needs ${(nativePixels / 1e6).toFixed(1)} million native pixels; this browser allows ${nativeBudget / 1e6} million. Corrupted canopy overviews are never used.`);
    }
    if (code !== 'chm') {
      const desiredRatio = Math.max(window[2] - window[0], window[3] - window[1]) / edge;
      const nativeWidth = image.getWidth();
      for (let index = 1; index < await tiff.getImageCount(); index += 1) {
        const candidate = await tiff.getImage(index);
        if (nativeWidth / candidate.getWidth() <= desiredRatio) image = candidate;
      }
    }
    const resolution = [referenceResolution[0] * referenceImage.getWidth() / image.getWidth(),
      referenceResolution[1] * referenceImage.getHeight() / image.getHeight()];
    window = imageWindow(image, nativeBounds, origin, resolution);
    const windowWidth = window[2] - window[0];
    const windowHeight = window[3] - window[1];
    const scale = Math.min(1, edge / Math.max(windowWidth, windowHeight));
    const sourceWidth = Math.max(1, Math.round(windowWidth * scale));
    const sourceHeight = Math.max(1, Math.round(windowHeight * scale));
    onProgress(code === 'chm' ? 'Reading native 30 m canopy pixels' : 'Reading raster window');
    const samples = await image.readRasters({ window, width: sourceWidth, height: sourceHeight,
      samples: [0], interleave: true, resampleMethod: 'nearest', signal });
    const nodata = referenceImage.getGDALNoData();
    const [originX, originY] = origin;
    const [resolutionX, resolutionY] = resolution;
    const westX = originX + window[0] * resolutionX;
    const northY = originY + window[1] * resolutionY;
    const pixelX = windowWidth * resolutionX / sourceWidth;
    const pixelY = windowHeight * resolutionY / sourceHeight;
    const mercatorBounds = projectedBounds(bounds, geographicToMercator);
    const [left, bottom, right, top] = mercatorBounds;
    const aspect = (right - left) / (top - bottom);
    const width = aspect >= 1 ? edge : Math.max(1, Math.round(edge * aspect));
    const height = aspect >= 1 ? Math.max(1, Math.round(edge / aspect)) : edge;
    const values = new Float32Array(width * height).fill(NaN);
    onProgress('Reprojecting preview');
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const [nativeX, nativeY] = mercatorToNative.forward([
          left + (column + 0.5) * (right - left) / width,
          top - (row + 0.5) * (top - bottom) / height,
        ]);
        const sourceColumn = Math.floor((nativeX - westX) / pixelX);
        const sourceRow = Math.floor((nativeY - northY) / pixelY);
        if (sourceColumn >= 0 && sourceRow >= 0 && sourceColumn < sourceWidth && sourceRow < sourceHeight) {
          values[row * width + column] = cleanValue(samples[sourceRow * sourceWidth + sourceColumn], code, nodata);
        }
      }
    }
    return { values, width, height, bounds, mercatorBounds, code, source: sourceUrl(code),
      native: code === 'chm', stats: statistics(values) };
  } finally {
    await tiff.close();
  }
}