import { HORIZONS } from './config.js';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HOURLY_FIELDS = [
  'precipitation_probability',
  'precipitation',
  'rain',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function sum(values) {
  return values.reduce((total, value) => total + finite(value), 0);
}

function maximum(values) {
  const numeric = values.map((value) => Number(value)).filter(Number.isFinite);
  return numeric.length ? Math.max(...numeric) : null;
}

function average(values) {
  const numeric = values.map((value) => Number(value)).filter(Number.isFinite);
  return numeric.length ? sum(numeric) / numeric.length : null;
}

function isoFromUnix(value) {
  const unix = Number(value);
  return Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null;
}

function bangkokDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function directionLabel(degrees) {
  if (!Number.isFinite(Number(degrees))) return 'ไม่ทราบทิศ';
  const labels = [
    'เหนือ',
    'ตะวันออกเฉียงเหนือ',
    'ตะวันออก',
    'ตะวันออกเฉียงใต้',
    'ใต้',
    'ตะวันตกเฉียงใต้',
    'ตะวันตก',
    'ตะวันตกเฉียงเหนือ',
  ];
  return labels[Math.round((((Number(degrees) % 360) + 360) % 360) / 45) % 8];
}

export function classifyRainSeverity({
  totalRainMm = 0,
  peakRainMmPerHour = 0,
  probabilityPct = 0,
  gustKph = 0,
  thunderstorm = false,
} = {}) {
  if (
    thunderstorm
    || totalRainMm >= 120
    || peakRainMmPerHour >= 20
    || gustKph >= 70
  ) return 'CRITICAL';
  if (
    totalRainMm >= 70
    || peakRainMmPerHour >= 10
    || gustKph >= 50
  ) return 'HIGH';
  if (
    totalRainMm >= 35
    || peakRainMmPerHour >= 2.5
    || (probabilityPct >= 70 && (totalRainMm >= 0.2 || peakRainMmPerHour >= 0.2))
    || gustKph >= 35
  ) return 'MODERATE';
  return 'LOW';
}

function getHourlyArrays(payload) {
  const hourly = payload?.hourly || {};
  return {
    times: hourly.time || [],
    precipitation: hourly.precipitation || [],
    probability: hourly.precipitation_probability || [],
    weatherCodes: hourly.weather_code || [],
    clouds: hourly.cloud_cover || [],
    winds: hourly.wind_speed_10m || [],
    directions: hourly.wind_direction_10m || [],
    gusts: hourly.wind_gusts_10m || [],
  };
}

function slice(values, hours) {
  return values.slice(0, Math.min(hours, values.length));
}

export function parseOpenMeteoForecast(payload, {
  plot,
  horizon = '24h',
  asOf = new Date(),
  source = 'Open-Meteo Forecast API',
} = {}) {
  if (!plot?.representativePoint) {
    return {
      mode: 'UNAVAILABLE',
      source,
      updatedAt: asOf.toISOString(),
      confidence: null,
      unavailableReason: 'ไม่มีข้อมูลตำแหน่งของแปลง',
    };
  }

  const arrays = getHourlyArrays(payload);
  if (!arrays.times.length) {
    return {
      mode: 'UNAVAILABLE',
      source,
      updatedAt: asOf.toISOString(),
      confidence: null,
      unavailableReason: 'ผู้ให้บริการไม่ส่งข้อมูลพยากรณ์รายชั่วโมงกลับมา',
    };
  }

  const horizonHours = Math.min(HORIZONS[horizon] || 24, arrays.times.length);
  const horizonPrecipitation = slice(arrays.precipitation, horizonHours);
  const first24Precipitation = slice(arrays.precipitation, 24);
  const first24Probability = slice(arrays.probability, 24);
  const first24Gusts = slice(arrays.gusts, 24);
  const first24Codes = slice(arrays.weatherCodes, 24);
  const rainOnsetIndex = horizonPrecipitation.findIndex((value) => finite(value) >= 0.2);
  const peakRainValue = maximum(horizonPrecipitation) || 0;
  const peakRainIndex = horizonPrecipitation.findIndex((value) => finite(value) === peakRainValue);
  const directionIndex = rainOnsetIndex >= 0 ? rainOnsetIndex : Math.max(0, peakRainIndex);
  const windFromDeg = finite(arrays.directions[directionIndex], null);
  const movementTowardDeg = Number.isFinite(windFromDeg) ? (windFromDeg + 180) % 360 : null;

  const dailyGroups = new Map();
  arrays.times.forEach((unix, index) => {
    const timestamp = isoFromUnix(unix);
    if (!timestamp) return;
    const date = bangkokDateKey(timestamp);
    if (!dailyGroups.has(date)) {
      dailyGroups.set(date, {
        date,
        times: [],
        precipitation: [],
        probability: [],
        weatherCodes: [],
        gusts: [],
        clouds: [],
      });
    }
    const day = dailyGroups.get(date);
    day.times.push(timestamp);
    day.precipitation.push(arrays.precipitation[index]);
    day.probability.push(arrays.probability[index]);
    day.weatherCodes.push(arrays.weatherCodes[index]);
    day.gusts.push(arrays.gusts[index]);
    day.clouds.push(arrays.clouds[index]);
  });

  const dailyRain = [...dailyGroups.values()].slice(0, 7).map((day) => {
    const totalRainMm = round(sum(day.precipitation));
    const peakRainMmPerHour = round(maximum(day.precipitation) || 0);
    const probabilityPct = Math.round(maximum(day.probability) || 0);
    const peakGustKph = round(maximum(day.gusts) || 0);
    const thunderstorm = day.weatherCodes.some((code) => THUNDERSTORM_CODES.has(Number(code)));
    const onsetIndex = day.precipitation.findIndex((value) => finite(value) >= 0.2);
    const peakIndex = peakRainMmPerHour > 0
      ? day.precipitation.findIndex((value) => finite(value) === peakRainMmPerHour)
      : -1;
    return {
      date: day.date,
      totalRainMm,
      probabilityPct,
      peakRainMmPerHour,
      peakRainAt: peakIndex >= 0 ? day.times[peakIndex] : null,
      rainOnsetAt: onsetIndex >= 0 ? day.times[onsetIndex] : null,
      peakGustKph,
      cloudPct: Math.round(average(day.clouds) || 0),
      thunderstorm,
      severity: classifyRainSeverity({
        totalRainMm,
        peakRainMmPerHour,
        probabilityPct,
        gustKph: peakGustKph,
        thunderstorm,
      }),
    };
  });

  const rainNext24hMm = round(sum(first24Precipitation));
  const rainProbabilityPct = Math.round(maximum(first24Probability) || 0);
  const gustKph = round(maximum(first24Gusts) || 0);
  const thunderstorm = first24Codes.some((code) => THUNDERSTORM_CODES.has(Number(code)));
  const rainSeverity = classifyRainSeverity({
    totalRainMm: rainNext24hMm,
    peakRainMmPerHour: maximum(first24Precipitation) || 0,
    probabilityPct: rainProbabilityPct,
    gustKph,
    thunderstorm,
  });

  return {
    forecastStart: isoFromUnix(arrays.times[0]),
    forecastEnd: isoFromUnix(arrays.times[Math.max(0, horizonHours - 1)]),
    rainNext6hMm: round(sum(slice(arrays.precipitation, 6))),
    rainNext24hMm,
    rainProbabilityPct,
    rainDurationHours: horizonPrecipitation.filter((value) => finite(value) >= 0.2).length,
    rainOnsetAt: rainOnsetIndex >= 0 ? isoFromUnix(arrays.times[rainOnsetIndex]) : null,
    peakRainAt: peakRainValue > 0 && peakRainIndex >= 0 ? isoFromUnix(arrays.times[peakRainIndex]) : null,
    peakRainMmPerHour: round(peakRainValue),
    windKph: round(maximum(slice(arrays.winds, 24)) || 0),
    gustKph,
    windDirectionFromDeg: windFromDeg,
    windDirectionFromLabel: directionLabel(windFromDeg),
    rainMovementTowardDeg: movementTowardDeg,
    rainMovementTowardLabel: directionLabel(movementTowardDeg),
    movementMethod: 'ทิศทางเคลื่อนตัวประมาณจากลมระดับ 10 เมตร ณ ช่วงฝนเริ่ม ไม่ใช่เรดาร์ nowcast',
    cloudPct: Math.round(average(slice(arrays.clouds, 24)) || 0),
    thunderstorm,
    weatherCode: Number(payload?.current?.weather_code ?? arrays.weatherCodes[0] ?? 0),
    rainSeverity,
    dailyRain,
    tidePercentile: null,
    surgeAlert: null,
    tideStatus: 'UNAVAILABLE',
    tideReason: 'ยังไม่มีการผูกสถานีน้ำขึ้นลงที่ยืนยันกับแต่ละแปลง',
    source,
    updatedAt: isoFromUnix(payload?.current?.time) || asOf.toISOString(),
    confidence: null,
    confidenceLabel: 'Open-Meteo ไม่รายงานค่าความเชื่อมั่นรายจุด',
    mode: 'LIVE',
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function forecastCell(point, step = 0.05) {
  return {
    lat: Math.round(point.lat / step) * step,
    lng: Math.round(point.lng / step) * step,
  };
}

function unavailableForecast(plot, reason, asOf, source) {
  return {
    mode: 'UNAVAILABLE',
    source,
    updatedAt: asOf.toISOString(),
    confidence: null,
    unavailableReason: plot.representativePoint ? reason : 'ไม่มีข้อมูลตำแหน่งของแปลง',
  };
}

export class OpenMeteoEnvironmentalProvider {
  constructor({
    cacheTtlSeconds = 900,
    endpoint = OPEN_METEO_FORECAST_URL,
    fetchImpl = fetch,
  } = {}) {
    this.cacheTtlSeconds = cacheTtlSeconds;
    this.endpoint = endpoint;
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.mode = 'LIVE';
    this.source = 'Open-Meteo Forecast API';
  }

  async getForecasts({ plots, horizon = '24h', asOf = new Date() }) {
    const results = new Map();
    const locatedPlots = plots.filter((plot) => plot.representativePoint);
    plots.filter((plot) => !plot.representativePoint).forEach((plot) => {
      results.set(plot.plotKey || `${plot.projectId}:${plot.plotId}`, unavailableForecast(
        plot,
        'ไม่มีข้อมูลตำแหน่งของแปลง',
        asOf,
        this.source,
      ));
    });

    const cellMap = new Map();
    locatedPlots.forEach((plot) => {
      const point = forecastCell(plot.representativePoint);
      const key = `${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
      if (!cellMap.has(key)) cellMap.set(key, { ...point, plots: [] });
      cellMap.get(key).plots.push(plot);
    });

    const cellChunks = chunk([...cellMap.values()], 35);
    for (const cellChunk of cellChunks) {
      const url = new URL(this.endpoint);
      url.searchParams.set('latitude', cellChunk.map((cell) => cell.lat).join(','));
      url.searchParams.set('longitude', cellChunk.map((cell) => cell.lng).join(','));
      url.searchParams.set('hourly', HOURLY_FIELDS.join(','));
      url.searchParams.set('current', [
        'precipitation',
        'rain',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','));
      url.searchParams.set('forecast_hours', String(Math.max(168, HORIZONS[horizon] || 24)));
      url.searchParams.set('timeformat', 'unixtime');
      url.searchParams.set('timezone', 'Asia/Bangkok');
      url.searchParams.set('wind_speed_unit', 'kmh');
      url.searchParams.set('precipitation_unit', 'mm');

      let payloads = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3 && !payloads; attempt += 1) {
        try {
          const response = await this.fetchImpl(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          payloads = Array.isArray(payload) ? payload : [payload];
        } catch (error) {
          lastError = error;
          if (attempt < 2) await wait(350 * (attempt + 1));
        }
      }

      if (payloads) {
        cellChunk.forEach((cell, index) => {
          cell.plots.forEach((plot) => {
            const forecast = parseOpenMeteoForecast(payloads[index], {
              plot,
              horizon,
              asOf,
              source: this.source,
            });
            results.set(
              plot.plotKey || `${plot.projectId}:${plot.plotId}`,
              {
                ...forecast,
                forecastGridPoint: {
                  lat: Number(payloads[index]?.latitude ?? cell.lat),
                  lng: Number(payloads[index]?.longitude ?? cell.lng),
                },
                spatialMethod: 'จับคู่กับกริดพยากรณ์ใกล้สุดช่วงประมาณ 0.05° เพื่อลดคำขอซ้ำในแปลงที่อยู่ติดกัน',
              },
            );
          });
        });
      } else {
        cellChunk.flatMap((cell) => cell.plots).forEach((plot) => {
          results.set(
            plot.plotKey || `${plot.projectId}:${plot.plotId}`,
            unavailableForecast(
              plot,
              `Open-Meteo ตอบกลับไม่สำเร็จ (${lastError?.message || 'unknown error'})`,
              asOf,
              this.source,
            ),
          );
        });
      }
    }

    return plots.map((plot) => results.get(plot.plotKey || `${plot.projectId}:${plot.plotId}`));
  }

  async getForecast({ plot, horizon = '24h', asOf = new Date() }) {
    return (await this.getForecasts({ plots: [plot], horizon, asOf }))[0];
  }
}
