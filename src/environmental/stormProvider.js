import { fetchWithTimeout } from './fetchWithTimeout.js';

const GDACS_LATEST_URL = 'https://www.gdacs.org/gdacsapi/api/Events/geteventlist/latest';
const GDACS_POLYGON_URL = 'https://www.gdacs.org/gdacsapi/api/Polygons/getgeometry';

function parseTrackPolygonTime(label, storm, asOf) {
  const match = String(label || '').match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+UTC$/i);
  if (!match) return null;
  const [, day, month, hour, minute] = match;
  const referenceYear = new Date(storm.fromDate || asOf).getUTCFullYear();
  const candidates = [referenceYear - 1, referenceYear, referenceYear + 1].map((year) => (
    new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute)))
  ));
  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate.getTime() - asOf.getTime()) < Math.abs(closest.getTime() - asOf.getTime())
      ? candidate
      : closest
  ));
}

function toRadians(value) {
  return Number(value) * Math.PI / 180;
}

export function haversineKm(left, right) {
  if (!left || !right) return null;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(right.lat - left.lat);
  const longitudeDelta = toRadians(right.lng - left.lng);
  const leftLatitude = toRadians(left.lat);
  const rightLatitude = toRadians(right.lat);
  const a = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2
  );
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapAlertLevel(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'RED') return 'CRITICAL';
  if (normalized === 'ORANGE') return 'HIGH';
  if (normalized === 'YELLOW') return 'MODERATE';
  if (normalized === 'GREEN') return 'LOW';
  return 'UNKNOWN';
}

function nearestDistance(point, plots) {
  const distances = plots
    .map((plot) => haversineKm(point, plot.representativePoint))
    .filter(Number.isFinite);
  return distances.length ? Math.min(...distances) : null;
}

export function parseGdacsStorms(payload, plots, asOf = new Date()) {
  const features = payload?.features || [];
  const recentCutoff = asOf.getTime() - 7 * 24 * 60 * 60 * 1000;
  return features
    .filter((feature) => feature?.properties?.eventtype === 'TC')
    .map((feature) => {
      const properties = feature.properties || {};
      const coordinates = feature.geometry?.coordinates || [];
      const point = Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))
        ? { lng: Number(coordinates[0]), lat: Number(coordinates[1]) }
        : null;
      const toDate = properties.todate ? new Date(`${properties.todate}Z`) : null;
      const distanceKm = nearestDistance(point, plots);
      const trackEnded = Boolean(toDate && toDate.getTime() < asOf.getTime());
      return {
        eventId: properties.eventid,
        episodeId: properties.episodeid,
        name: properties.eventname || properties.name || 'ไม่ระบุชื่อ',
        title: properties.name || properties.description || 'Tropical Cyclone',
        alertLevel: properties.alertlevel || 'Unknown',
        severity: mapAlertLevel(properties.alertlevel),
        maxWindKph: Number.isFinite(Number(properties.severitydata?.severity))
          ? Math.round(Number(properties.severitydata.severity))
          : null,
        intensityText: properties.severitydata?.severitytext || 'GDACS ไม่ระบุความรุนแรง',
        fromDate: properties.fromdate ? `${properties.fromdate}Z` : null,
        toDate: properties.todate ? `${properties.todate}Z` : null,
        modifiedAt: properties.datemodified ? `${properties.datemodified}Z` : null,
        sourceAgency: properties.source || 'GDACS',
        countries: properties.country || '',
        isCurrentRecord: String(properties.iscurrent).toLowerCase() === 'true',
        trackEnded,
        distanceKm: Number.isFinite(distanceKm) ? Math.round(distanceKm) : null,
        influenceZone: Number.isFinite(distanceKm) && distanceKm <= 2500 ? 'REGIONAL' : 'DISTANT',
        position: point,
        reportUrl: properties.url?.report || null,
      };
    })
    .filter((storm) => (
      storm.isCurrentRecord
      || (storm.toDate && new Date(storm.toDate).getTime() >= recentCutoff)
    ))
    .sort((left, right) => (
      Number(left.trackEnded) - Number(right.trackEnded)
      || (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity)
    ));
}

export async function getStormImpactGeometry({
  storm,
  fetchImpl = fetch,
  requestTimeoutMs = 45000,
  asOf = new Date(),
} = {}) {
  if (!storm || storm.trackEnded || !storm.eventId || !storm.episodeId) {
    return {
      status: 'UNAVAILABLE',
      source: 'GDACS / European Commission',
      features: [],
      note: 'ไม่มีพายุ active ที่มีรหัส event และ episode สำหรับดึง polygon',
    };
  }

  const query = new URLSearchParams({
    eventtype: 'TC',
    eventid: String(storm.eventId),
    episodeid: String(storm.episodeId),
  });
  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      `${GDACS_POLYGON_URL}?${query}`,
      { headers: { Accept: 'application/geo+json, application/json' }, cache: 'no-store' },
      requestTimeoutMs,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const sourceFeatures = Array.isArray(payload) ? payload : payload?.features || [];
    const features = sourceFeatures
      .map((feature) => ({
        feature,
        forecastAt: parseTrackPolygonTime(feature?.properties?.polygonlabel, storm, asOf),
      }))
      .filter(({ feature, forecastAt }) => (
        ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)
        && forecastAt
        && forecastAt.getTime() >= asOf.getTime()
      ))
      .map(({ feature, forecastAt }) => ({
        ...feature,
        properties: {
          ...(feature.properties || {}),
          data_status: 'OFFICIAL',
          valid_until: storm.toDate,
          event_id: storm.eventId,
          episode_id: storm.episodeId,
          storm_name: storm.name,
          forecast_at: forecastAt.toISOString(),
          source: 'GDACS / European Commission',
        },
      }));
    return {
      type: 'FeatureCollection',
      status: features.length ? 'AVAILABLE' : 'UNAVAILABLE',
      source: 'GDACS / European Commission',
      eventId: storm.eventId,
      episodeId: storm.episodeId,
      validUntil: storm.toDate,
      features,
      note: features.length
        ? 'polygon เขตพายุดึงใหม่จาก GDACS ตาม event และ episode ล่าสุด'
        : 'GDACS ไม่ส่ง polygon สำหรับ episode ล่าสุด',
    };
  } catch (error) {
    return {
      type: 'FeatureCollection',
      status: 'UNAVAILABLE',
      source: 'GDACS / European Commission',
      features: [],
      note: `โหลด polygon เขตพายุไม่สำเร็จ (${error.message})`,
    };
  }
}

export async function getPortfolioStormContext({
  plots,
  asOf = new Date(),
  fetchImpl = fetch,
  endpoint = GDACS_LATEST_URL,
  requestTimeoutMs = 8000,
} = {}) {
  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      endpoint,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
      requestTimeoutMs,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const storms = parseGdacsStorms(await response.json(), plots, asOf);
    const regional = storms.filter((storm) => storm.influenceZone === 'REGIONAL');
    return {
      status: 'AVAILABLE',
      source: 'GDACS / European Commission',
      updatedAt: asOf.toISOString(),
      activeNamedStorm: regional.find((storm) => !storm.trackEnded) || regional[0] || null,
      regionalStorms: regional,
      note: regional.length
        ? 'ระยะห่างคำนวณจากตำแหน่งล่าสุดของพายุถึงจุดตัวแทนแปลงที่ใกล้ที่สุด'
        : 'ไม่พบพายุหมุนเขตร้อนในระยะ 2,500 กม. จากพอร์ตแปลงในข้อมูล GDACS ล่าสุด',
    };
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      source: 'GDACS / European Commission',
      updatedAt: asOf.toISOString(),
      activeNamedStorm: null,
      regionalStorms: [],
      note: `โหลดข้อมูลพายุไม่สำเร็จ (${error.message})`,
    };
  }
}
