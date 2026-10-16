/* Mangrove Environmental Observation Core v0.1.0.
 * Pure, dependency-free observation primitives. Runs as a classic browser script,
 * inside importScripts() workers and as an ESM side-effect import. No network,
 * DOM, storage, GIS area algorithms, provider or domain-specific risk thresholds.
 */
(function (root) {
  'use strict';
  const VERSION = '0.1.0';
  const TIME_ZONE = 'Asia/Bangkok';
  const AREA_M2_PER_UNIT = Object.freeze({ rai: 1600, ha: 10000, km2: 1000000 });

  // Preserve legacy SAT FLOOD fallback (unknown unit => km2). Do not round here.
  function areaValue(squareM, unit) {
    return squareM == null ? null : squareM / (AREA_M2_PER_UNIT[unit] || 1000000);
  }

  // Presentation only. Callers own the display options and missing-value labels.
  function formatBangkok(value, options) {
    return new Intl.DateTimeFormat('th-TH', { ...options, timeZone: TIME_ZONE }).format(new Date(value));
  }

  function collectCoordinatePairs(coordinates, pairs = []) {
    if (!Array.isArray(coordinates)) return pairs;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      pairs.push(coordinates);
      return pairs;
    }
    coordinates.forEach((item) => collectCoordinatePairs(item, pairs));
    return pairs;
  }

  function collectGeometryPairs(geometry, pairs = []) {
    if (!geometry) return pairs;
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries?.forEach((item) => collectGeometryPairs(item, pairs));
      return pairs;
    }
    return collectCoordinatePairs(geometry.coordinates, pairs);
  }

  // Do not infer a polygon's area, CRS, valid observation mask or flood state from bounds.
  // Identical traversal/finite-number semantics to the Rayong Worker baseline.
  function geometryBounds(geometry) {
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    const visit = (value) => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        west = Math.min(west, value[0]);
        south = Math.min(south, value[1]);
        east = Math.max(east, value[0]);
        north = Math.max(north, value[1]);
        return;
      }
      for (const child of value) visit(child);
    };
    if (!geometry || typeof geometry !== 'object') return null;
    if (geometry.coordinates) visit(geometry.coordinates);
    for (const child of geometry.geometries || []) {
      const childBounds = geometryBounds(child);
      if (!childBounds) continue;
      west = Math.min(west, childBounds[0]);
      south = Math.min(south, childBounds[1]);
      east = Math.max(east, childBounds[2]);
      north = Math.max(north, childBounds[3]);
    }
    return [west, south, east, north].every(Number.isFinite) && west <= east && south <= north
      ? [west, south, east, north] : null;
  }

  // Provenance timestamp: never substitute import time or assume UTC/Bangkok for
  // an acquisition without an explicit ISO 8601 zone. Mirrors SAT FLOOD v1.
  function zonedAcquisitionISO(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
      throw new Error('วันที่ต้องระบุเขตเวลา เช่น 2026-09-25T05:59:35Z');
    const time = Date.parse(value);
    if (!Number.isFinite(time)) throw new Error('วันที่ไม่ถูกต้อง');
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
    if (!m) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    const [, y, mo, d, h, mi, s] = m;
    const days = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > days || +h > 23 || +mi > 59 || +(s || 0) > 59)
      throw new Error('วันที่อยู่นอกช่วงที่ถูกต้อง');
    return new Date(time).toISOString();
  }

  // STAC de-dup identity is scoped to collection: the same scene ID may exist
  // in different collections. Do not use provider display labels as keys.
  function stacSceneKey(collection, itemId) {
    return String(collection || '') + ':' + String(itemId || '');
  }

  root.MangroveObservationCore = Object.freeze({
    VERSION, TIME_ZONE, AREA_M2_PER_UNIT, areaValue, formatBangkok,
    collectCoordinatePairs, collectGeometryPairs, geometryBounds,
    zonedAcquisitionISO, stacSceneKey,
  });
})(globalThis);
