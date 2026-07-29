import { HORIZONS } from './config.js';
import { OpenMeteoEnvironmentalProvider } from './openMeteoProvider.js';

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ratio(seed, salt) {
  return hashString(`${seed}:${salt}`) / 4294967295;
}

function skewedNumber(seed, salt, min, max, power = 2, decimals = 1) {
  const value = min + (ratio(seed, salt) ** power) * (max - min);
  return Number(value.toFixed(decimals));
}

export class DeterministicMockEnvironmentalProvider {
  constructor({ cacheTtlSeconds = 900 } = {}) {
    this.cacheTtlSeconds = cacheTtlSeconds;
    this.mode = 'SIMULATED';
    this.source = 'Deterministic Mock Provider';
  }

  async getForecast({ plot, horizon = '24h', asOf = new Date() }) {
    if (!plot.representativePoint) {
      return {
        mode: 'UNAVAILABLE',
        source: this.source,
        updatedAt: asOf.toISOString(),
        confidence: 0,
        unavailableReason: 'ไม่มีข้อมูลตำแหน่งของแปลง',
      };
    }

    const ttlMs = this.cacheTtlSeconds * 1000;
    const bucket = new Date(Math.floor(asOf.getTime() / ttlMs) * ttlMs);
    const seed = `${plot.plotId}|${horizon}|${bucket.toISOString()}`;
    const hours = HORIZONS[horizon] || HORIZONS['24h'];
    const rain24 = skewedNumber(seed, 'rain24', 0, 135, 2.4);
    const rain6 = Math.min(rain24, skewedNumber(seed, 'rain6', 0, 50, 2.2));
    const wind = skewedNumber(seed, 'wind', 4, 48, 2.4);
    const gust = Math.max(wind, skewedNumber(seed, 'gust', 6, 64, 2.3));
    const cloud = Math.round(skewedNumber(seed, 'cloud', 8, 100, 1.8, 0));
    const rainProbability = Math.round(skewedNumber(seed, 'rain-probability', 5, 100, 1.8, 0));
    const thunderstorm = ratio(seed, 'thunderstorm') > 0.95;

    return {
      forecastStart: bucket.toISOString(),
      forecastEnd: new Date(bucket.getTime() + hours * 60 * 60 * 1000).toISOString(),
      rainNext6hMm: rain6,
      rainNext24hMm: rain24,
      rainProbabilityPct: rainProbability,
      windKph: wind,
      gustKph: gust,
      cloudPct: cloud,
      thunderstorm,
      tidePercentile: null,
      surgeAlert: null,
      tideStatus: 'UNAVAILABLE',
      tideReason: 'ไม่พบ station mapping เดิม จึงไม่เดาสถานีน้ำขึ้นน้ำลง',
      source: this.source,
      updatedAt: bucket.toISOString(),
      confidence: 0.72,
      mode: this.mode,
    };
  }
}

export function createEnvironmentalProvider(env = import.meta.env) {
  const providerName = env?.ENVIRONMENTAL_PROVIDER || env?.VITE_ENVIRONMENTAL_PROVIDER || 'open-meteo';
  const cacheTtlSeconds = Number(
    env?.VITE_ENVIRONMENTAL_CACHE_TTL_SECONDS
      || env?.ENVIRONMENTAL_CACHE_TTL_SECONDS
      || 900,
  );

  if (providerName === 'mock') return new DeterministicMockEnvironmentalProvider({ cacheTtlSeconds });
  if (providerName === 'open-meteo') {
    return new OpenMeteoEnvironmentalProvider({ cacheTtlSeconds });
  }
  throw new Error(`Environmental provider "${providerName}" ไม่รองรับ`);
}
