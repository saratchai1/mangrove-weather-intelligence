import { collectCoordinatePairs, collectGeometryPairs } from '../shared/observation-core/index.mjs';
export { collectCoordinatePairs, collectGeometryPairs };

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
