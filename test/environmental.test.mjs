import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicMockEnvironmentalProvider } from '../src/environmental/mockProvider.js';
import { fetchWithTimeout } from '../src/environmental/fetchWithTimeout.js';
import { assessOperationalRisk, metricLevel } from '../src/environmental/riskEngine.js';
import { OPERATIONAL_THRESHOLDS } from '../src/environmental/config.js';
import { getVisiblePlots } from '../src/environmental/plotRepository.js';
import {
  classifyRainSeverity,
  directionLabel,
  OpenMeteoEnvironmentalProvider,
  parseOpenMeteoForecast,
} from '../src/environmental/openMeteoProvider.js';
import { getStormImpactGeometry, parseGdacsStorms } from '../src/environmental/stormProvider.js';
import { evaluateWaterloggingAlert } from '../src/environmental/waterloggingAlerts.js';

const fixedTime = new Date('2026-07-29T04:00:00.000Z');
const genericPlot = {
  plotId: 'plot-1',
  representativePoint: { lat: 12.3, lng: 100.4 },
};

test('prototype rain thresholds use the configured boundary values', () => {
  const thresholds = OPERATIONAL_THRESHOLDS.rainNext24hMm;
  assert.equal(metricLevel(34.99, thresholds), 'LOW');
  assert.equal(metricLevel(35, thresholds), 'MODERATE');
  assert.equal(metricLevel(70, thresholds), 'HIGH');
  assert.equal(metricLevel(120, thresholds), 'CRITICAL');
});

test('mock provider is deterministic for the same plot, horizon, and time bucket', async () => {
  const provider = new DeterministicMockEnvironmentalProvider({ cacheTtlSeconds: 900 });
  const first = await provider.getForecast({ plot: genericPlot, horizon: '72h', asOf: fixedTime });
  const second = await provider.getForecast({ plot: genericPlot, horizon: '72h', asOf: fixedTime });
  assert.deepEqual(first, second);
  assert.equal(first.mode, 'SIMULATED');
  assert.equal(first.tideStatus, 'UNAVAILABLE');
});

test('plot without coordinates remains in the model with UNKNOWN risk', async () => {
  const provider = new DeterministicMockEnvironmentalProvider();
  const forecast = await provider.getForecast({
    plot: { plotId: 'plot-2', representativePoint: null },
    asOf: fixedTime,
  });
  const assessment = assessOperationalRisk(forecast);
  assert.equal(forecast.mode, 'UNAVAILABLE');
  assert.equal(assessment.overallRisk, 'UNKNOWN');
  assert.deepEqual(
    Object.values(assessment.impacts).map((item) => item.level),
    ['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN'],
  );
});

test('network timeout releases a stalled external provider', async () => {
  const stalledFetch = async (_input, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    fetchWithTimeout(stalledFetch, 'https://example.invalid', {}, 5),
    /หมดเวลารอผู้ให้บริการ/,
  );
});

test('plot repository loads every visible project dynamically and applies permission predicate', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/plot-risk-factors.json')) {
      return new Response(JSON.stringify({
        records: [{
          plotKey: 'g1-wisutti:plot-2',
          riskFactorCode: 'WATERLOGGING',
          riskFactorLabel: 'น้ำท่วมขัง',
          matchStatus: 'MATCHED',
        }],
      }), { status: 200 });
    }
    if (url.endsWith('/project.json')) {
      return new Response(JSON.stringify({ officialName: 'Generic project' }), { status: 200 });
    }
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { plotId: 'plot-1', province: 'จังหวัดทดสอบ' },
          geometry: { type: 'Point', coordinates: [100, 13] },
        },
        {
          type: 'Feature',
          properties: { plotId: 'plot-2', province: 'จังหวัดทดสอบ' },
          geometry: null,
        },
      ],
    }), { status: 200 });
  };

  const plots = await getVisiblePlots({
    fetchImpl,
    canViewPlot: (plot) => plot.plotId === 'plot-2',
  });
  assert.equal(plots.length, 4);
  assert.ok(plots.every((plot) => plot.plotId === 'plot-2'));
  assert.ok(plots.every((plot) => plot.representativePoint === null));
  assert.equal(
    plots.find((plot) => plot.projectId === 'g1-wisutti').riskFactor.riskFactorCode,
    'WATERLOGGING',
  );
});

test('red waterlogging warning requires registered risk, yellow-or-higher rain, and storm zone', () => {
  const riskFactor = { riskFactorCode: 'WATERLOGGING' };
  assert.deepEqual(
    evaluateWaterloggingAlert({ riskFactor, severity: 'MODERATE' }),
    { isWaterlogging: true, forecastRain: true, storm: false, active: false },
  );
  assert.equal(
    evaluateWaterloggingAlert({ riskFactor, severity: 'LOW', stormImpacted: true }).active,
    false,
  );
  assert.equal(
    evaluateWaterloggingAlert({ riskFactor, severity: 'HIGH', stormImpacted: true }).active,
    true,
  );
  assert.equal(
    evaluateWaterloggingAlert({ riskFactor, severity: 'CRITICAL', stormImpacted: true }).active,
    true,
  );
  assert.equal(evaluateWaterloggingAlert({ riskFactor, severity: 'LOW' }).active, false);
  assert.equal(
    evaluateWaterloggingAlert({ severity: 'CRITICAL', stormImpacted: true }).active,
    false,
  );
});

test('Open-Meteo payload becomes a dated rain timeline and movement direction', () => {
  const times = Array.from({ length: 48 }, (_, index) => (
    Math.floor(new Date('2026-07-29T05:00:00.000Z').getTime() / 1000) + index * 3600
  ));
  const precipitation = times.map((_, index) => (index >= 2 && index <= 5 ? 4 : 0));
  const payload = {
    current: { time: times[0], weather_code: 61 },
    hourly: {
      time: times,
      precipitation,
      precipitation_probability: times.map((_, index) => (index < 12 ? 80 : 20)),
      weather_code: times.map(() => 61),
      cloud_cover: times.map(() => 75),
      wind_speed_10m: times.map(() => 24),
      wind_direction_10m: times.map(() => 225),
      wind_gusts_10m: times.map(() => 36),
    },
  };
  const forecast = parseOpenMeteoForecast(payload, {
    plot: { ...genericPlot, plotKey: 'project:plot-1' },
    horizon: '7d',
    asOf: fixedTime,
  });
  assert.equal(forecast.mode, 'LIVE');
  assert.equal(forecast.rainOnsetAt, new Date(times[2] * 1000).toISOString());
  assert.equal(forecast.rainMovementTowardLabel, 'ตะวันออกเฉียงเหนือ');
  assert.equal(forecast.dailyRain.length, 3);
  assert.equal(forecast.dailyRain[0].severity, 'MODERATE');
  assert.equal(forecast.confidence, null);
});

test('rain severity follows yellow, orange, and red operational boundaries', () => {
  assert.equal(classifyRainSeverity({ probabilityPct: 70, totalRainMm: 1 }), 'MODERATE');
  assert.equal(classifyRainSeverity({ probabilityPct: 90, totalRainMm: 0 }), 'LOW');
  assert.equal(classifyRainSeverity({ totalRainMm: 70 }), 'HIGH');
  assert.equal(classifyRainSeverity({ thunderstorm: true }), 'CRITICAL');
  assert.equal(directionLabel(225), 'ตะวันตกเฉียงใต้');
});

test('GDACS cyclone parser preserves official name, alert, wind, and nearest distance', () => {
  const storms = parseGdacsStorms({
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101, 14] },
      properties: {
        eventtype: 'TC',
        eventid: 100,
        episodeid: 7,
        eventname: 'GENERIC-26',
        name: 'Tropical Cyclone GENERIC-26',
        alertlevel: 'Orange',
        iscurrent: 'true',
        fromdate: '2026-07-28T00:00:00',
        todate: '2026-07-30T00:00:00',
        datemodified: '2026-07-29T00:00:00',
        source: 'JTWC',
        country: 'Generic country',
        severitydata: {
          severity: 150,
          severitytext: 'maximum wind speed of 150 km/h',
        },
        url: { report: 'https://example.invalid/report' },
      },
    }],
  }, [{ representativePoint: { lat: 14.1, lng: 101.1 } }], fixedTime);
  assert.equal(storms.length, 1);
  assert.equal(storms[0].name, 'GENERIC-26');
  assert.equal(storms[0].episodeId, 7);
  assert.equal(storms[0].severity, 'HIGH');
  assert.equal(storms[0].maxWindKph, 150);
  assert.ok(storms[0].distanceKm < 20);
});

test('GDACS storm impact loader refreshes official polygon geometry for an active episode', async () => {
  let requestedUrl = '';
  const zone = await getStormImpactGeometry({
    storm: {
      eventId: 100,
      episodeId: 7,
      name: 'GENERIC-26',
      toDate: '2026-07-30T00:00:00.000Z',
      trackEnded: false,
    },
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { polygonlabel: '29/07 12:00 UTC' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[100, 10], [101, 10], [101, 11], [100, 10]]],
          },
        }],
      }), { status: 200 });
    },
    asOf: fixedTime,
  });
  assert.match(requestedUrl, /eventid=100/);
  assert.match(requestedUrl, /episodeid=7/);
  assert.equal(zone.status, 'AVAILABLE');
  assert.equal(zone.features[0].properties.data_status, 'OFFICIAL');
  assert.equal(zone.features[0].properties.storm_name, 'GENERIC-26');
  assert.equal(zone.features[0].properties.forecast_at, '2026-07-29T12:00:00.000Z');
});

test('live provider reuses one nearby weather grid for adjacent plots', async () => {
  let requestCount = 0;
  const fetchImpl = async function fetchForecast(url) {
    assert.equal(this, undefined);
    requestCount += 1;
    const coordinates = new URL(url).searchParams.get('latitude').split(',');
    const payloads = coordinates.map(() => {
      const times = Array.from({ length: 168 }, (_, index) => (
        Math.floor(fixedTime.getTime() / 1000) + index * 3600
      ));
      return {
        latitude: 12.3,
        longitude: 100.4,
        current: { time: times[0], weather_code: 61 },
        hourly: {
          time: times,
          precipitation: times.map(() => 0.5),
          precipitation_probability: times.map(() => 80),
          weather_code: times.map(() => 61),
          cloud_cover: times.map(() => 70),
          wind_speed_10m: times.map(() => 20),
          wind_direction_10m: times.map(() => 180),
          wind_gusts_10m: times.map(() => 30),
        },
      };
    });
    return new Response(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads), { status: 200 });
  };
  const provider = new OpenMeteoEnvironmentalProvider({ fetchImpl });
  const forecasts = await provider.getForecasts({
    plots: [
      { plotId: 'plot-1', plotKey: 'project:plot-1', representativePoint: { lat: 12.301, lng: 100.401 } },
      { plotId: 'plot-2', plotKey: 'project:plot-2', representativePoint: { lat: 12.302, lng: 100.402 } },
    ],
    horizon: '7d',
    asOf: fixedTime,
  });
  assert.equal(requestCount, 1);
  assert.equal(forecasts.length, 2);
  assert.ok(forecasts.every((forecast) => forecast.mode === 'LIVE'));
  assert.deepEqual(forecasts[0].forecastGridPoint, forecasts[1].forecastGridPoint);
});
