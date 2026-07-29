import {
  IMPACT_TYPES,
  OPERATIONAL_THRESHOLDS,
  RISK_RANK,
} from './config.js';

function metricLevel(value, thresholds) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'UNKNOWN';
  if (value >= thresholds.critical) return 'CRITICAL';
  if (value >= thresholds.high) return 'HIGH';
  if (value >= thresholds.moderate) return 'MODERATE';
  return 'LOW';
}

function maxRisk(levels) {
  const known = levels.filter((level) => level && level !== 'UNKNOWN');
  if (!known.length) return 'UNKNOWN';
  return known.reduce((worst, level) => (
    RISK_RANK[level] > RISK_RANK[worst] ? level : worst
  ), 'LOW');
}

function scoreFromLevel(level, bump = 0) {
  const base = { LOW: 18, MODERATE: 45, HIGH: 72, CRITICAL: 94, UNKNOWN: 0 }[level] ?? 0;
  return Math.min(100, base + bump);
}

function impact(type, level, reasons, recommendedActions, flags = []) {
  return {
    type,
    level,
    score: scoreFromLevel(level, Math.min(reasons.length * 2, 6)),
    reasons,
    recommendedActions,
    flags,
  };
}

function droneImpact(forecast) {
  const reasons = [];
  const actions = [];
  const levels = [
    metricLevel(forecast.rainNext6hMm, OPERATIONAL_THRESHOLDS.rainNext6hMm),
    metricLevel(forecast.rainProbabilityPct, OPERATIONAL_THRESHOLDS.rainProbabilityPct),
    metricLevel(forecast.windKph, OPERATIONAL_THRESHOLDS.windKph),
    metricLevel(forecast.gustKph, OPERATIONAL_THRESHOLDS.gustKph),
  ];
  if (forecast.thunderstorm) levels.push('CRITICAL');
  const level = maxRisk(levels);

  if (forecast.rainNext6hMm >= 10) reasons.push(`ฝนระยะ 6 ชม. ${forecast.rainNext6hMm} มม.`);
  if (forecast.rainProbabilityPct >= 50) reasons.push(`โอกาสฝน ${forecast.rainProbabilityPct}%`);
  if (forecast.gustKph >= 30) reasons.push(`ลมกระโชก ${forecast.gustKph} กม./ชม.`);
  if (forecast.thunderstorm) reasons.push('มีสัญญาณพายุฝนฟ้าคะนองในข้อมูลพยากรณ์');
  if (level === 'LOW') reasons.push('ไม่พบปัจจัยอากาศพยากรณ์ที่เกิน threshold ขั้นต้น');

  if (RISK_RANK[level] >= RISK_RANK.HIGH) actions.push('เลื่อนการบินและตรวจสภาพจริง/ข้อกำหนดการบินก่อนปฏิบัติงาน');
  else if (level === 'MODERATE') actions.push('ตรวจลมและฝนหน้างานอีกครั้งก่อนปล่อยอากาศยาน');
  else actions.push('ติดตาม nowcast และทำ pre-flight checklist ตามปกติ');
  return impact('DRONE', level, reasons, actions);
}

function fieldImpact(forecast) {
  const rainLevel = metricLevel(forecast.rainNext24hMm, OPERATIONAL_THRESHOLDS.rainNext24hMm);
  const tideLevel = metricLevel(forecast.tidePercentile, OPERATIONAL_THRESHOLDS.tidePercentile);
  const level = maxRisk([rainLevel, forecast.thunderstorm ? 'HIGH' : 'LOW', tideLevel]);
  const reasons = [];
  const actions = [];
  if (forecast.rainNext24hMm >= 35) reasons.push(`ฝนสะสม 24 ชม. ${forecast.rainNext24hMm} มม.`);
  if (forecast.thunderstorm) reasons.push('อาจมีพายุฝนฟ้าคะนอง');
  if (forecast.tideStatus === 'UNAVAILABLE') reasons.push('ไม่มีข้อมูล tide station ที่ยืนยันแล้ว');
  if (!reasons.length) reasons.push('ความเสี่ยงการลงพื้นที่จากข้อมูลพยากรณ์อยู่ในระดับต่ำ');
  if (RISK_RANK[level] >= RISK_RANK.MODERATE) actions.push('ควรตรวจสอบการเข้าถึงพื้นที่และสภาพหน้างานก่อนออกเดินทาง');
  else actions.push('ดำเนินแผนลงพื้นที่ได้โดยติดตามประกาศล่าสุด');
  if (forecast.tideStatus === 'UNAVAILABLE') actions.push('ตรวจเวลาน้ำขึ้นลงจากแหล่งทางการก่อนเข้าพื้นที่ชายฝั่ง');
  return impact('FIELD', level, reasons, actions, forecast.tideStatus === 'UNAVAILABLE' ? ['TIDE_UNAVAILABLE'] : []);
}

function satelliteImpact(forecast) {
  const cloudLevel = metricLevel(forecast.cloudPct, OPERATIONAL_THRESHOLDS.cloudPct);
  const rainLevel = metricLevel(forecast.rainNext24hMm, OPERATIONAL_THRESHOLDS.rainNext24hMm);
  const level = maxRisk([cloudLevel, rainLevel]);
  const reasons = [];
  const actions = ['ควรตรวจ scene metadata ก่อนใช้งานจริง'];
  if (forecast.cloudPct >= 80) reasons.push(`มีความเสี่ยงเมฆบังสูง (${forecast.cloudPct}%)`);
  else if (forecast.cloudPct >= 60) reasons.push(`แนวโน้มการมองเห็นต่ำ (${forecast.cloudPct}% cloud)`);
  if (forecast.rainNext24hMm >= 35) reasons.push('สภาพฝนอาจลดคุณภาพภาพที่ใช้คัดกรอง');
  if (!reasons.length) reasons.push('แนวโน้ม cloud/rain จากข้อมูลพยากรณ์อยู่ในระดับต่ำ');
  return impact('SATELLITE', level, reasons, actions, forecast.cloudPct >= 80 ? ['HIGH_CLOUD_RISK'] : []);
}

function dataQualityImpact(forecast) {
  const rainLevel = metricLevel(forecast.rainNext24hMm, OPERATIONAL_THRESHOLDS.rainNext24hMm);
  const cloudLevel = metricLevel(forecast.cloudPct, OPERATIONAL_THRESHOLDS.cloudPct);
  const tideLevel = metricLevel(forecast.tidePercentile, OPERATIONAL_THRESHOLDS.tidePercentile);
  const level = maxRisk([rainLevel, cloudLevel, tideLevel]);
  const flags = [];
  const reasons = [];
  if (forecast.rainNext24hMm >= 35) {
    flags.push('RAIN_REFLECTION_RISK');
    reasons.push('ฝน/พื้นผิวเปียกอาจเพิ่มความเสี่ยง reflection');
  }
  if (forecast.cloudPct >= 60) {
    flags.push('LOW_LIGHT_RISK');
    reasons.push('เมฆมากอาจทำให้สภาพแสงไม่สม่ำเสมอ');
  }
  if (forecast.tideStatus === 'UNAVAILABLE') flags.push('TIDE_UNAVAILABLE');
  if (!reasons.length) reasons.push('Low data-quality risk จากตัวแปรที่มี');
  const label = `${level[0]}${level.slice(1).toLowerCase()} data-quality risk`;
  return impact('DATA_QUALITY', level, [label, ...reasons], ['ตรวจ QA/QC ของภาพและข้อมูลภาคสนามก่อนวิเคราะห์'], flags);
}

export function assessOperationalRisk(forecast) {
  if (!forecast || forecast.mode === 'UNAVAILABLE') {
    const unknown = Object.fromEntries(IMPACT_TYPES.map((type) => [
      type,
      impact(type, 'UNKNOWN', [forecast?.unavailableReason || 'ไม่มีข้อมูลพยากรณ์'], ['เพิ่มข้อมูลตำแหน่งและลองใหม่'], ['LOCATION_UNAVAILABLE']),
    ]));
    return { overallRisk: 'UNKNOWN', impacts: unknown, dataQualityFlags: ['LOCATION_UNAVAILABLE'] };
  }

  const impacts = {
    DRONE: droneImpact(forecast),
    FIELD: fieldImpact(forecast),
    SATELLITE: satelliteImpact(forecast),
    DATA_QUALITY: dataQualityImpact(forecast),
  };
  const overallRisk = maxRisk(Object.values(impacts).map((item) => item.level));
  const dataQualityFlags = [...new Set(Object.values(impacts).flatMap((item) => item.flags))];
  return { overallRisk, impacts, dataQualityFlags };
}

export { maxRisk, metricLevel };
