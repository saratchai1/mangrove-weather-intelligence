import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeterministicMockEnvironmentalProvider } from '../src/environmental/mockProvider.js';
import { assessOperationalRisk } from '../src/environmental/riskEngine.js';
import { getRepresentativePoint } from '../src/utils/geometry.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataRoot = path.join(root, 'public', 'data');
const projectIds = ['g1-wisutti', 'g1-siam-tc', 'g2-wisutti', 'g2-siam-tc'];
const provider = new DeterministicMockEnvironmentalProvider();
const asOf = new Date('2026-07-29T04:00:00.000Z');
const seen = new Set();
let total = 0;
let unavailable = 0;

for (const projectId of projectIds) {
  const file = path.join(dataRoot, projectId, 'planting-areas.geojson');
  const geojson = JSON.parse(await fs.readFile(file, 'utf8'));
  assert(geojson.type === 'FeatureCollection', `${projectId}: invalid FeatureCollection`);

  for (const feature of geojson.features) {
    const plotId = String(feature.properties?.plotId || '').trim();
    assert(plotId, `${projectId}: feature without plotId`);
    assert(!seen.has(plotId), `duplicate plotId: ${plotId}`);
    seen.add(plotId);
    total += 1;

    const representativePoint = getRepresentativePoint(feature);
    if (!representativePoint) unavailable += 1;
    const forecast = await provider.getForecast({
      plot: { plotId, representativePoint },
      horizon: '24h',
      asOf,
    });
    const assessment = assessOperationalRisk(forecast);
    assert(
      ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNKNOWN'].includes(assessment.overallRisk),
      `${plotId}: invalid risk`,
    );
  }
}

const riskData = JSON.parse(await fs.readFile(path.join(dataRoot, 'plot-risk-factors.json'), 'utf8'));
const matchedRiskRecords = riskData.records.filter((record) => record.matchStatus === 'MATCHED');
const unmatchedRiskRecords = riskData.records.filter((record) => record.matchStatus === 'UNMATCHED');
assert(riskData.records.length === 9, `expected 9 waterlogging records, found ${riskData.records.length}`);
assert(matchedRiskRecords.length === 7, `expected 7 matched waterlogging records, found ${matchedRiskRecords.length}`);
assert(unmatchedRiskRecords.length === 2, `expected 2 unmatched waterlogging records, found ${unmatchedRiskRecords.length}`);
assert(
  new Set(matchedRiskRecords.map((record) => record.plotKey)).size === matchedRiskRecords.length,
  'duplicate matched waterlogging plotKey',
);
for (const record of matchedRiskRecords) {
  assert(record.riskFactorCode === 'WATERLOGGING', `${record.plotId}: invalid risk factor code`);
  assert(seen.has(record.plotId), `${record.plotId}: matched waterlogging plot is absent from GIS data`);
}

assert(total === 129, `expected 129 plot records, found ${total}`);
console.log(JSON.stringify({
  projectCount: projectIds.length,
  plotRecordCount: total,
  uniquePlotIdCount: seen.size,
  unavailableLocationCount: unavailable,
  providerMode: provider.mode,
  waterloggingSourceCount: riskData.records.length,
  waterloggingMatchedCount: matchedRiskRecords.length,
  waterloggingUnmatchedCount: unmatchedRiskRecords.length,
}, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
