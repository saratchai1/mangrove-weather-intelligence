const WATERLOGGING_WARNING_LEVELS = new Set(['MODERATE', 'HIGH', 'CRITICAL']);

export function evaluateWaterloggingAlert({
  riskFactor,
  severity = 'UNKNOWN',
  stormImpacted = false,
} = {}) {
  const isWaterlogging = riskFactor?.riskFactorCode === 'WATERLOGGING';
  const forecastRain = isWaterlogging && WATERLOGGING_WARNING_LEVELS.has(severity);
  const storm = isWaterlogging && Boolean(stormImpacted);

  return {
    isWaterlogging,
    forecastRain,
    storm,
    active: forecastRain && storm,
  };
}
