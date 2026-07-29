import { IMPACT_TYPES, RISK_LEVELS } from './config.js';
import { createEnvironmentalProvider } from './mockProvider.js';
import { getVisiblePlots } from './plotRepository.js';
import { assessOperationalRisk } from './riskEngine.js';
import { getPortfolioStormContext } from './stormProvider.js';

export const ENVIRONMENTAL_API_ROUTES = {
  overview: '/api/v1/environmental-intelligence/overview',
  plot: '/api/v1/environmental-intelligence/plots/:plotId',
};

let overviewCache = null;

function validateQuery({ horizon = '24h', risk = 'ALL', impact = 'ALL' }) {
  if (!['24h', '72h', '7d'].includes(horizon)) throw new Error('horizon ไม่ถูกต้อง');
  if (risk !== 'ALL' && !RISK_LEVELS.includes(risk)) throw new Error('risk ไม่ถูกต้อง');
  if (impact !== 'ALL' && !IMPACT_TYPES.includes(impact)) throw new Error('impact ไม่ถูกต้อง');
}

function getEffectiveRisk(plot, impact) {
  return impact === 'ALL' ? plot.overallRisk : plot.impacts[impact]?.level || 'UNKNOWN';
}

function summarize(plots) {
  const count = (level) => plots.filter((plot) => plot.overallRisk === level).length;
  return {
    total: plots.length,
    critical: count('CRITICAL'),
    high: count('HIGH'),
    moderate: count('MODERATE'),
    low: count('LOW'),
    unknown: count('UNKNOWN'),
    postEventInspection: plots.filter((plot) => (
      ['HIGH', 'CRITICAL'].includes(plot.overallRisk)
      && (
        plot.forecast?.thunderstorm
        || Number(plot.forecast?.rainNext24hMm) >= 70
      )
    )).length,
  };
}

export async function getEnvironmentalOverview({
  horizon = '24h',
  risk = 'ALL',
  impact = 'ALL',
  asOf = new Date(),
  forceRefresh = false,
  fetchImpl = fetch,
  canViewPlot,
  providerEnv,
} = {}) {
  validateQuery({ horizon, risk, impact });
  const provider = createEnvironmentalProvider(providerEnv);
  const bucket = Math.floor(asOf.getTime() / (provider.cacheTtlSeconds * 1000));
  const cacheKey = `${horizon}|${bucket}`;
  const canUseSharedCache = !canViewPlot;

  if (canUseSharedCache && !forceRefresh && overviewCache?.key === cacheKey) {
    const cachedPlots = overviewCache.plots;
    const filtered = cachedPlots.filter((plot) => (
      risk === 'ALL' || getEffectiveRisk(plot, impact) === risk
    ));
    return { ...overviewCache.base, summary: summarize(cachedPlots), plots: filtered, query: { horizon, risk, impact } };
  }

  const sourcePlots = await getVisiblePlots({ fetchImpl, canViewPlot });
  const [forecasts, stormContext] = await Promise.all([
    provider.getForecasts
      ? provider.getForecasts({ plots: sourcePlots, horizon, asOf })
      : Promise.all(sourcePlots.map((plot) => provider.getForecast({ plot, horizon, asOf }))),
    getPortfolioStormContext({ plots: sourcePlots, asOf }),
  ]);
  const plots = sourcePlots.map((plot, index) => {
    const forecast = forecasts[index];
    const assessment = assessOperationalRisk(forecast);
    return { ...plot, forecast, ...assessment };
  });

  const base = {
    mode: provider.mode,
    source: provider.source,
    generatedAt: asOf.toISOString(),
    stormContext,
    disclaimer: 'Operational Risk Heuristic ใช้สนับสนุนการวางแผนเท่านั้น ไม่ใช่การรับรองความปลอดภัยหรือคาร์บอนเครดิต',
  };
  if (canUseSharedCache) overviewCache = { key: cacheKey, plots, base };
  const filtered = plots.filter((plot) => risk === 'ALL' || getEffectiveRisk(plot, impact) === risk);
  return { ...base, summary: summarize(plots), plots: filtered, query: { horizon, risk, impact } };
}

export async function getEnvironmentalPlot(plotId, options = {}) {
  const overview = await getEnvironmentalOverview({ ...options, risk: 'ALL', impact: 'ALL' });
  const plot = overview.plots.find((item) => item.plotId === plotId);
  if (!plot) throw new Error(`ไม่พบแปลง ${plotId}`);
  return plot;
}
