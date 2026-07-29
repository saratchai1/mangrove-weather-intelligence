export const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNKNOWN'];
export const IMPACT_TYPES = ['DRONE', 'FIELD', 'SATELLITE', 'DATA_QUALITY'];
export const HORIZONS = {
  '24h': 24,
  '72h': 72,
  '7d': 168,
};

// Prototype operational thresholds only. These are not government criteria,
// aviation safety requirements, or carbon-credit verification rules.
export const OPERATIONAL_THRESHOLDS = {
  rainNext6hMm: { moderate: 10, high: 25, critical: 45 },
  rainNext24hMm: { moderate: 35, high: 70, critical: 120 },
  rainProbabilityPct: { moderate: 50, high: 70, critical: 90 },
  windKph: { moderate: 20, high: 35, critical: 50 },
  gustKph: { moderate: 30, high: 45, critical: 60 },
  cloudPct: { moderate: 60, high: 80, critical: 95 },
  tidePercentile: { moderate: 80, high: 90, critical: 97 },
};

export const RISK_RANK = {
  UNKNOWN: -1,
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export const RISK_COLORS = {
  LOW: '#16845b',
  MODERATE: '#d8a514',
  HIGH: '#e87516',
  CRITICAL: '#d9363e',
  UNKNOWN: '#87938e',
};
