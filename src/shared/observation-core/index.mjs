// ESM bridge to the same classic-script/Worker build used by SAT FLOOD.
import './core.js';
const core = globalThis.MangroveObservationCore;
export const VERSION = core.VERSION;
export const TIME_ZONE = core.TIME_ZONE;
export const AREA_M2_PER_UNIT = core.AREA_M2_PER_UNIT;
export const areaValue = core.areaValue;
export const formatBangkok = core.formatBangkok;
export const collectCoordinatePairs = core.collectCoordinatePairs;
export const collectGeometryPairs = core.collectGeometryPairs;
export const geometryBounds = core.geometryBounds;
export const zonedAcquisitionISO = core.zonedAcquisitionISO;
export const stacSceneKey = core.stacSceneKey;
