import test from 'node:test';
import assert from 'node:assert/strict';
import { fromArrayBuffer } from 'geotiff';
import { cleanValue, exportPreview, LAYERS, projectedBounds, sourceUrl, statistics, validateBounds } from '../src/raster.js';

test('all 22 products have verified unit labels', () => {
  assert.equal(LAYERS.length, 22);
  assert.ok(LAYERS.every((layer) => layer.units));
  assert.equal(LAYERS.find((layer) => layer.code === 'chm').units, 'm');
  assert.equal(LAYERS.find((layer) => layer.code === 'cc_first_ge2').units, '%');
});
test('fill drift and negative canopy are masked; terrain and zero heights remain', () => {
  for (const value of [-9999, -9999.015, -9998.99]) assert.ok(Number.isNaN(cleanValue(value, 'dtm')));
  assert.ok(Number.isNaN(cleanValue(-7000, 'chm')));
  assert.equal(cleanValue(-2, 'dtm'), -2);
  assert.equal(cleanValue(0, 'chm'), 0);
  assert.equal(cleanValue(300, 'chm'), 300);
});
test('invalid and nonfinite extents are rejected', () => {
  assert.throws(() => validateBounds([-122, 37, -123, 38]));
  assert.throws(() => validateBounds([NaN, 37, -121, 38]));
  validateBounds([-122.3, 37, -121.85, 37.35]);
});
test('California Albers projection is metric and has sensible bounds', () => {
  const bounds = projectedBounds([-122.3, 37, -121.85, 37.35]);
  assert.ok(bounds[2] - bounds[0] > 39000 && bounds[2] - bounds[0] < 42000);
  assert.ok(bounds[3] - bounds[1] > 38000 && bounds[3] - bounds[1] < 41000);
});
test('statistics ignore nodata and retain meaningful percentile limits', () => {
  const stats = statistics(new Float32Array([0, 10, 20, NaN]));
  assert.equal(stats.median, 10);
  assert.equal(stats.coverage, 0.75);
  assert.ok(stats.lower >= 0 && stats.upper <= 20);
  assert.throws(() => statistics(new Float32Array([NaN])));
});
test('source URL permits only the published inventory', () => {
  assert.match(sourceUrl('campaign_year'), /30m_epsg3310_campaign_year/);
  assert.throws(() => sourceUrl('../secret'));
});
test('GeoTIFF export retains float values, nodata, projection and processing provenance', async () => {
  const preview = { values: new Float32Array([0, 42, NaN, 7]), width: 2, height: 2,
    code: 'chm', native: true, mercatorBounds: [-100, 100, -40, 160], source: sourceUrl('chm') };
  const tiff = await fromArrayBuffer(await exportPreview(preview));
  const image = await tiff.getImage();
  assert.equal(image.getGeoKeys().ProjectedCSTypeGeoKey, 3857);
  assert.deepEqual(image.getOrigin().slice(0, 2), [-100, 160]);
  assert.deepEqual(Array.from(await image.readRasters({ interleave: true })), [0, 42, NaN, 7]);
  const metadata = JSON.parse(image.fileDirectory.getValue('ImageDescription').replace(/\0+$/, ''));
  assert.equal(metadata.units, 'm');
  assert.equal(metadata.source_overviews, false);
  assert.ok(Number.isNaN(image.getGDALNoData()));
});