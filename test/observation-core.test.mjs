import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { formatBangkok, collectGeometryPairs, VERSION } from '../src/shared/observation-core/index.mjs';
import { getRepresentativePoint } from '../src/utils/geometry.js';
const blob = (relative) => {
  const data = readFileSync(new URL(relative, import.meta.url));
  return createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
};
test('shared observation core is an immutable version-pinned snapshot', () => {
  assert.equal(blob('../src/shared/observation-core/core.js'), 'b51165d97d05756e6dca3ed7836b1bd5e6980dd3');
  assert.equal(blob('../src/shared/observation-core/index.mjs'), '4023fa066f261f3a91a7db754768dad8143a93bc');
  assert.equal(blob('../src/shared/observation-core/index.d.mts'), '423479ae4ab0e8bb865bbc44ff22922049301a52');
  assert.equal(VERSION, '0.1.0');
});
test('weather representative geometry preserves coordinate-mean baseline', () => {
  const sample = { geometry: { type: 'MultiPoint', coordinates: [[100, 13], [101, 15], [102, 13]] } };
  assert.equal(collectGeometryPairs(sample.geometry).length, 3);
  assert.deepEqual(getRepresentativePoint(sample), { lat: 41 / 3, lng: 101 });
});
test('environmental forecast presentation stays in Bangkok', () => {
  const value = '2026-09-25T05:59:35Z';
  assert.equal(formatBangkok(value, { dateStyle: 'medium', timeStyle: 'short' }),
    new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)));
});
test('SAT FLOOD private repository is not embedded in the public site', () => {
  const source = readFileSync(new URL('../src/EnvironmentalIntelligence.jsx', import.meta.url), 'utf8');
  assert.match(source, /GitHub \(Private\)/);
  assert.doesNotMatch(source, /<iframe[\s\S]*sat-flood/);
});
