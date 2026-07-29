export function collectCoordinatePairs(coordinates, pairs = []) {
  if (!Array.isArray(coordinates)) return pairs;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    pairs.push(coordinates);
    return pairs;
  }
  coordinates.forEach((item) => collectCoordinatePairs(item, pairs));
  return pairs;
}

export function collectGeometryPairs(geometry, pairs = []) {
  if (!geometry) return pairs;
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach((item) => collectGeometryPairs(item, pairs));
    return pairs;
  }
  return collectCoordinatePairs(geometry.coordinates, pairs);
}

export function getRepresentativePoint(feature) {
  const pairs = collectGeometryPairs(feature?.geometry);
  if (!pairs.length) return null;

  const finitePairs = pairs.filter((pair) => (
    Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
  ));
  if (!finitePairs.length) return null;

  const totals = finitePairs.reduce((sum, pair) => ({
    lng: sum.lng + Number(pair[0]),
    lat: sum.lat + Number(pair[1]),
  }), { lat: 0, lng: 0 });

  return {
    lat: totals.lat / finitePairs.length,
    lng: totals.lng / finitePairs.length,
  };
}
