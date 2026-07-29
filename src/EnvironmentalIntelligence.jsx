import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CloudLightning,
  CloudRain,
  Crosshair,
  Database,
  ExternalLink,
  Eye,
  Layers,
  MapPinned,
  Navigation,
  Plane,
  Radio,
  RefreshCw,
  Satellite,
  Search,
  ShieldAlert,
  Timer,
  Waves,
  Wind,
} from 'lucide-react';
import {
  IMPACT_TYPES,
  RISK_COLORS,
  RISK_RANK,
} from './environmental/config';
import { fetchEnvironmentalOverview } from './environmental/apiClient';
import './EnvironmentalIntelligence.css';

const ALL = 'ALL';
const RISK_LABELS = {
  LOW: 'เขียว',
  MODERATE: 'เหลือง',
  HIGH: 'ส้ม',
  CRITICAL: 'แดง',
  UNKNOWN: 'ไม่มีข้อมูล',
};
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'UNKNOWN'];
const IMPACT_LABELS = {
  ALL: 'ภาพรวมทั้งหมด',
  DRONE: 'การบินโดรน',
  FIELD: 'การลงพื้นที่',
  SATELLITE: 'ภาพดาวเทียม',
  DATA_QUALITY: 'คุณภาพข้อมูล',
};
const IMPACT_ICONS = {
  DRONE: Plane,
  FIELD: MapPinned,
  SATELLITE: Satellite,
  DATA_QUALITY: Eye,
};

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function formatDay(value, weekday = true) {
  if (!value) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+07:00`)
    : new Date(value);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function formatTime(value) {
  if (!value) return 'ไม่มีฝนเด่นชัด';
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

function getDailyForecast(plot, selectedDate) {
  return plot?.forecast?.dailyRain?.find((day) => day.date === selectedDate)
    || plot?.forecast?.dailyRain?.[0]
    || null;
}

function getMapSeverity(plot, selectedDate) {
  if (plot?.mapSeverity) return plot.mapSeverity;
  return getDailyForecast(plot, selectedDate)?.severity
    || plot?.forecast?.rainSeverity
    || 'UNKNOWN';
}

function worstSeverity(counts) {
  return SEVERITY_ORDER.find((level) => counts[level] > 0) || 'UNKNOWN';
}

function severityGradient(counts) {
  const total = SEVERITY_ORDER.reduce((sum, level) => sum + (counts[level] || 0), 0);
  if (!total) return RISK_COLORS.UNKNOWN;
  let cursor = 0;
  const segments = [];
  SEVERITY_ORDER.forEach((level) => {
    const count = counts[level] || 0;
    if (!count) return;
    const start = cursor;
    cursor += (count / total) * 100;
    segments.push(`${RISK_COLORS[level]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);
  });
  return segments.length === 1
    ? segments[0].split(' ')[0]
    : `conic-gradient(${segments.join(', ')})`;
}

function meanDirection(plots) {
  const directions = plots
    .map((plot) => Number(plot.forecast?.rainMovementTowardDeg))
    .filter(Number.isFinite);
  if (!directions.length) return null;
  const vector = directions.reduce((sum, degrees) => ({
    x: sum.x + Math.sin(degrees * Math.PI / 180),
    y: sum.y + Math.cos(degrees * Math.PI / 180),
  }), { x: 0, y: 0 });
  return (Math.atan2(vector.x, vector.y) * 180 / Math.PI + 360) % 360;
}

function buildProvinceForecasts(plots, selectedDate) {
  const groups = new Map();
  plots.forEach((plot) => {
    if (!plot.representativePoint) return;
    const province = plot.province || 'ไม่ระบุจังหวัด';
    if (!groups.has(province)) groups.set(province, []);
    groups.get(province).push(plot);
  });
  return [...groups.entries()].map(([province, provincePlots]) => {
    const days = provincePlots.map((plot) => plot.mapDay || getDailyForecast(plot, selectedDate));
    const counts = Object.fromEntries(SEVERITY_ORDER.map((level) => [
      level,
      provincePlots.filter((plot) => getMapSeverity(plot, selectedDate) === level).length,
    ]));
    const rainTotals = days.map((day) => Number(day?.totalRainMm || 0));
    const probabilities = days.map((day) => Number(day?.probabilityPct || 0));
    const onsetTimes = days.map((day) => day?.rainOnsetAt).filter(Boolean).sort();
    return {
      province,
      plots: provincePlots,
      count: provincePlots.length,
      counts,
      severity: worstSeverity(counts),
      gradient: severityGradient(counts),
      maxRainMm: Math.max(0, ...rainTotals),
      averageRainMm: rainTotals.reduce((sum, value) => sum + value, 0) / rainTotals.length,
      probabilityPct: Math.max(0, ...probabilities),
      rainOnsetAt: onsetTimes[0] || null,
      directionDeg: meanDirection(provincePlots),
      position: [
        provincePlots.reduce((sum, plot) => sum + plot.representativePoint.lat, 0) / provincePlots.length,
        provincePlots.reduce((sum, plot) => sum + plot.representativePoint.lng, 0) / provincePlots.length,
      ],
    };
  });
}

function RiskBadge({ level = 'UNKNOWN', compact = false, label }) {
  return (
    <span className={`environment-risk risk-${level.toLowerCase()} ${compact ? 'compact' : ''}`}>
      <i style={{ background: RISK_COLORS[level] }} />
      {label || RISK_LABELS[level] || level}
    </span>
  );
}

function EnvironmentalMap({
  plots,
  selectedPlotKey,
  focusPlotKey,
  selectedDate,
  layers,
  onSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const operationalLayersRef = useRef([]);
  const featureLayersRef = useRef({});
  const mapSeverityCounts = Object.fromEntries(SEVERITY_ORDER.map((level) => [
    level,
    plots.filter((plot) => getMapSeverity(plot, selectedDate) === level).length,
  ]));
  const mapMaxRainMm = Math.max(
    0,
    ...plots.map((plot) => Number((plot.mapDay || getDailyForecast(plot, selectedDate))?.totalRainMm || 0)),
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Basemap © Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: 'Labels © CARTO',
      pane: 'overlayPane',
      opacity: 0.78,
    }).addTo(map);
    map.setView([10.3, 100.3], 6);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      operationalLayersRef.current = [];
      featureLayersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    operationalLayersRef.current.forEach((layer) => layer.remove());
    operationalLayersRef.current = [];
    featureLayersRef.current = {};

    const mappedPlots = plots.filter((plot) => plot.geometry);
    if (!mappedPlots.length) return;
    const provinceForecasts = buildProvinceForecasts(mappedPlots, selectedDate);
    const byKey = Object.fromEntries(mappedPlots.map((plot) => [plot.plotKey, plot]));
    const featureCollection = {
      type: 'FeatureCollection',
      features: mappedPlots.map((plot) => ({
        type: 'Feature',
        geometry: plot.geometry,
        properties: { plotKey: plot.plotKey },
      })),
    };

    const polygonLayer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const plot = byKey[feature.properties.plotKey];
        const severity = getMapSeverity(plot, selectedDate);
        const selected = plot.plotKey === selectedPlotKey;
        return {
          color: selected ? '#ffffff' : '#102b24',
          weight: selected ? 3.6 : 1.25,
          opacity: 0.95,
          fillColor: RISK_COLORS[severity],
          fillOpacity: selected ? 0.74 : 0.48,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const plot = byKey[feature.properties.plotKey];
        const day = plot.mapDay || getDailyForecast(plot, selectedDate);
        const severity = getMapSeverity(plot, selectedDate);
        featureLayersRef.current[plot.plotKey] = featureLayer;
        featureLayer.bindTooltip(
          `<div class="map-tooltip">
            <b>${escapeHtml(plot.plotName)}</b>
            <span>${escapeHtml(plot.projectName)}</span>
            <hr>
            <strong>${escapeHtml(formatNumber(day?.totalRainMm, 1))} มม.</strong> · ${escapeHtml(RISK_LABELS[severity])}
            <small>ฝนเริ่ม ${escapeHtml(formatTime(day?.rainOnsetAt))}</small>
          </div>`,
          { sticky: true, className: 'environment-map-tooltip' },
        );
        featureLayer.on('click', () => onSelect(plot.plotKey));
      },
    });
    if (layers.plots) polygonLayer.addTo(map);
    operationalLayersRef.current.push(polygonLayer);

    const rainGroup = L.featureGroup();
    const directionGroup = L.featureGroup();
    const provinceForecastGroup = L.featureGroup();
    const directionCells = new Set();
    mappedPlots.forEach((plot) => {
      if (!plot.representativePoint) return;
      const day = plot.mapDay || getDailyForecast(plot, selectedDate);
      const severity = getMapSeverity(plot, selectedDate);
      const position = [plot.representativePoint.lat, plot.representativePoint.lng];
      const rainTotal = Number(day?.totalRainMm || 0);
      const circle = L.circleMarker(position, {
        className: `rain-severity-${severity.toLowerCase()}`,
        radius: Math.max(5, Math.min(16, 5 + Math.sqrt(rainTotal))),
        color: '#ffffff',
        weight: 1.5,
        fillColor: RISK_COLORS[severity],
        fillOpacity: 0.92,
      });
      circle.bindTooltip(
        `<div class="map-tooltip">
          <b>${escapeHtml(plot.plotName)}</b>
          <span>${escapeHtml(formatDay(selectedDate))}</span>
          <hr>
          <strong>${escapeHtml(formatNumber(rainTotal, 1))} มม.</strong> · โอกาสฝน ${escapeHtml(formatNumber(day?.probabilityPct))}%
          <small>สูงสุด ${escapeHtml(formatNumber(day?.peakRainMmPerHour, 1))} มม./ชม.</small>
        </div>`,
        { sticky: true, className: 'environment-map-tooltip' },
      );
      circle.on('click', () => onSelect(plot.plotKey));
      circle.addTo(rainGroup);

      const direction = plot.forecast?.rainMovementTowardDeg;
      const directionCell = `${plot.representativePoint.lat.toFixed(1)}:${plot.representativePoint.lng.toFixed(1)}`;
      if (
        Number.isFinite(Number(direction))
        && day?.rainOnsetAt
        && !directionCells.has(directionCell)
      ) {
        directionCells.add(directionCell);
        L.marker(position, {
          interactive: false,
          icon: L.divIcon({
            className: 'environment-direction-icon',
            html: `<span style="transform:rotate(${Number(direction)}deg)">↑</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(directionGroup);
      }
    });

    provinceForecasts.forEach((forecast) => {
      const directionArrow = (
        layers.direction && Number.isFinite(forecast.directionDeg)
          ? `<i class="province-forecast-arrow" style="transform:rotate(${forecast.directionDeg}deg)">↑</i>`
          : ''
      );
      const marker = L.marker(forecast.position, {
        zIndexOffset: 1000 + RISK_RANK[forecast.severity] * 100,
        icon: L.divIcon({
          className: 'province-forecast-icon',
          html: `<div class="province-forecast-marker severity-${forecast.severity.toLowerCase()}">
            <div class="province-forecast-donut" style="background:${forecast.gradient}">
              <span><b>${escapeHtml(formatNumber(forecast.maxRainMm))}</b><small>มม.</small></span>
              ${directionArrow}
            </div>
            <strong>${escapeHtml(forecast.province)}</strong>
            <em>${escapeHtml(forecast.count)} แปลง · ${escapeHtml(formatNumber(forecast.probabilityPct))}%</em>
          </div>`,
          iconSize: [96, 88],
          iconAnchor: [48, 44],
        }),
      });
      marker.bindTooltip(
        `<div class="map-tooltip province-tooltip">
          <b>พยากรณ์จังหวัด${escapeHtml(forecast.province)}</b>
          <span>${escapeHtml(formatDay(selectedDate))} · ${escapeHtml(forecast.count)} แปลง</span>
          <hr>
          <strong>ฝนสูงสุด ${escapeHtml(formatNumber(forecast.maxRainMm, 1))} มม.</strong>
          <small>เฉลี่ย ${escapeHtml(formatNumber(forecast.averageRainMm, 1))} มม. · โอกาสฝนสูงสุด ${escapeHtml(formatNumber(forecast.probabilityPct))}%</small>
          <small>ฝนเริ่มเร็วสุด ${escapeHtml(formatTime(forecast.rainOnsetAt))}</small>
          <small>แดง ${forecast.counts.CRITICAL} · ส้ม ${forecast.counts.HIGH} · เหลือง ${forecast.counts.MODERATE} · เขียว ${forecast.counts.LOW}</small>
        </div>`,
        { direction: 'top', className: 'environment-map-tooltip' },
      );
      marker.on('click', () => {
        const bounds = L.latLngBounds(forecast.plots.map((plot) => [
          plot.representativePoint.lat,
          plot.representativePoint.lng,
        ]));
        if (bounds.isValid()) map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 11 });
      });
      marker.addTo(provinceForecastGroup);
    });

    const syncZoomLayers = () => {
      const overviewMode = map.getZoom() <= 7;
      rainGroup.remove();
      provinceForecastGroup.remove();
      directionGroup.remove();
      if (layers.rain) {
        if (overviewMode) provinceForecastGroup.addTo(map);
        else rainGroup.addTo(map);
      }
      if (layers.direction && !overviewMode) directionGroup.addTo(map);
    };
    map.on('zoomend', syncZoomLayers);
    operationalLayersRef.current.push(rainGroup, directionGroup, provinceForecastGroup);

    map.invalidateSize({ pan: false });
    const selectedLayer = featureLayersRef.current[focusPlotKey];
    if (selectedLayer && layers.plots) {
      selectedLayer.bringToFront();
      map.flyToBounds(selectedLayer.getBounds(), { padding: [38, 38], maxZoom: 15 });
    } else if (polygonLayer.getBounds().isValid()) {
      map.fitBounds(polygonLayer.getBounds(), { padding: [26, 26], maxZoom: 8 });
    }
    syncZoomLayers();
    return () => map.off('zoomend', syncZoomLayers);
  }, [focusPlotKey, layers, onSelect, plots, selectedDate, selectedPlotKey]);

  return (
    <div className="environment-map-shell">
      <div className="map-data-stamp">
        <Radio size={13} />
        <span>LIVE FORECAST</span>
        <b>{plots.length} แปลง</b>
      </div>
      <div className="map-forecast-stamp">
        <div><CloudRain size={14} /><span>พยากรณ์ {formatDay(selectedDate)}</span></div>
        <b>ฝนสูงสุด {formatNumber(mapMaxRainMm, 1)} มม.</b>
        <p>
          <i className="severity-red" />{mapSeverityCounts.CRITICAL}
          <i className="severity-orange" />{mapSeverityCounts.HIGH}
          <i className="severity-yellow" />{mapSeverityCounts.MODERATE}
          <i className="severity-green" />{mapSeverityCounts.LOW}
        </p>
        <small>ซูมไกล: รายจังหวัด · ซูมเข้า: รายแปลง</small>
      </div>
      <div className="environment-map" ref={containerRef} aria-label="แผนที่พยากรณ์ฝนและขอบเขตแปลงปลูก" />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = 'neutral', suffix = '' }) {
  return (
    <article className={`environment-summary-card tone-${tone}`}>
      <div><Icon size={18} /></div>
      <span>{label}</span>
      <strong>{formatNumber(value)}{suffix}</strong>
    </article>
  );
}

function StormBanner({ stormContext }) {
  const storm = stormContext?.activeNamedStorm;
  if (!storm) {
    return (
      <section className="storm-banner storm-clear">
        <div className="storm-symbol"><Activity size={24} /></div>
        <div>
          <p className="section-label">Tropical Cyclone Watch · GDACS</p>
          <h2>ไม่พบพายุหมุนเขตร้อนใกล้พอร์ตแปลง</h2>
          <p>{stormContext?.note || 'กำลังตรวจสอบข้อมูลพายุล่าสุด'}</p>
        </div>
        <span className="storm-status">{stormContext?.status || 'LOADING'}</span>
      </section>
    );
  }

  return (
    <section className={`storm-banner storm-${storm.severity.toLowerCase()}`}>
      <div className="storm-symbol"><CloudLightning size={26} /></div>
      <div className="storm-identity">
        <p className="section-label">Regional Tropical Cyclone Watch · GDACS</p>
        <div className="storm-title-row">
          <h2>{storm.name}</h2>
          <RiskBadge level={storm.severity} label={`GDACS ${storm.alertLevel}`} />
        </div>
        <p>{storm.trackEnded ? 'ข้อมูลเส้นทางล่าสุดสิ้นสุดแล้ว — ใช้ติดตามผลกระทบตกค้าง' : 'อยู่ระหว่างติดตามเส้นทางล่าสุด'}</p>
      </div>
      <dl className="storm-metrics">
        <div><dt>ความรุนแรงสูงสุด</dt><dd>{formatNumber(storm.maxWindKph)} กม./ชม.</dd></div>
        <div><dt>ช่วงเหตุการณ์</dt><dd>{formatDay(storm.fromDate, false)} – {formatDay(storm.toDate, false)}</dd></div>
        <div><dt>ใกล้แปลงที่สุด</dt><dd>{formatNumber(storm.distanceKm)} กม.</dd></div>
        <div><dt>แหล่งเส้นทาง</dt><dd>{storm.sourceAgency}</dd></div>
      </dl>
      {storm.reportUrl && (
        <a className="storm-report-link" href={storm.reportUrl} target="_blank" rel="noreferrer">
          รายงาน GDACS <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}

function RainDayStrip({ dates, selectedDate, onSelect }) {
  return (
    <div className="rain-day-strip" aria-label="เลือกวันที่พยากรณ์">
      {dates.map((date, index) => (
        <button
          type="button"
          key={date}
          className={date === selectedDate ? 'active' : ''}
          onClick={() => onSelect(date)}
        >
          <span>{index === 0 ? 'วันนี้' : index === 1 ? 'พรุ่งนี้' : `D+${index}`}</span>
          <b>{formatDay(date)}</b>
        </button>
      ))}
    </div>
  );
}

function ImpactCard({ item }) {
  const Icon = IMPACT_ICONS[item.type];
  return (
    <article className="impact-risk-card">
      <header>
        <span><Icon size={16} />{IMPACT_LABELS[item.type]}</span>
        <RiskBadge level={item.level} compact />
      </header>
      <div className="risk-score"><b>{item.score}</b><span>/100</span></div>
      <ul>
        {item.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </article>
  );
}

function PlotDetail({ plot, selectedDate }) {
  if (!plot) {
    return (
      <section className="environment-detail empty">
        <Crosshair size={25} />
        <h2>เลือกแปลงบนแผนที่</h2>
        <p>กด polygon หรือจุดพยากรณ์เพื่อดูเวลาฝน ทิศทาง และผลกระทบรายแปลง</p>
      </section>
    );
  }
  const forecast = plot.forecast;
  const selectedDay = getDailyForecast(plot, selectedDate);
  return (
    <section className="environment-detail">
      <header className="detail-title">
        <div>
          <p className="section-label">{plot.projectName}</p>
          <h2>{plot.plotName}</h2>
          <span>{[plot.subdistrict, plot.district, plot.province].filter(Boolean).join(' · ') || 'ไม่มีข้อมูลตำแหน่ง'}</span>
        </div>
        <RiskBadge level={selectedDay?.severity || forecast.rainSeverity || 'UNKNOWN'} />
      </header>

      {forecast.mode === 'UNAVAILABLE' ? (
        <div className="unavailable-note">
          <AlertTriangle size={18} />
          <p>{forecast.unavailableReason}</p>
        </div>
      ) : (
        <>
          <section className="selected-day-brief">
            <header>
              <div><CalendarDays size={17} /><span>พยากรณ์ {formatDay(selectedDay?.date)}</span></div>
              <b>{formatNumber(selectedDay?.totalRainMm, 1)} มม.</b>
            </header>
            <div className="selected-day-grid">
              <div><span>ฝนเริ่ม</span><strong>{formatTime(selectedDay?.rainOnsetAt)}</strong></div>
              <div><span>ฝนหนักสุด</span><strong>{formatTime(selectedDay?.peakRainAt)}</strong></div>
              <div><span>อัตราสูงสุด</span><strong>{formatNumber(selectedDay?.peakRainMmPerHour, 1)} มม./ชม.</strong></div>
              <div><span>โอกาสฝน</span><strong>{formatNumber(selectedDay?.probabilityPct)}%</strong></div>
            </div>
          </section>

          <section className="rain-movement-card">
            <div className="movement-compass">
              <Navigation
                size={28}
                style={{ transform: `rotate(${Number(forecast.rainMovementTowardDeg || 0)}deg)` }}
              />
            </div>
            <div>
              <p className="section-label">Rain movement proxy</p>
              <h3>แนวฝนเคลื่อนไปทาง{forecast.rainMovementTowardLabel}</h3>
              <p>ลมพัดมาจาก{forecast.windDirectionFromLabel} · {formatNumber(forecast.windKph, 1)} กม./ชม. · กระโชก {formatNumber(forecast.gustKph, 1)} กม./ชม.</p>
              <small>{forecast.movementMethod}</small>
            </div>
          </section>

          <div className="weather-kpis">
            <div><CloudRain size={17} /><span>ฝน 6 ชม.</span><strong>{formatNumber(forecast.rainNext6hMm, 1)} มม.</strong></div>
            <div><CloudRain size={17} /><span>ฝน 24 ชม.</span><strong>{formatNumber(forecast.rainNext24hMm, 1)} มม.</strong></div>
            <div><Wind size={17} /><span>ลมกระโชก</span><strong>{formatNumber(forecast.gustKph, 1)} กม./ชม.</strong></div>
            <div><Eye size={17} /><span>เมฆเฉลี่ย</span><strong>{formatNumber(forecast.cloudPct)}%</strong></div>
          </div>

          <section className="plot-rain-outlook">
            <h3>แนวโน้มฝน 7 วัน</h3>
            <div>
              {(forecast.dailyRain || []).map((day) => (
                <article key={day.date} className={day.date === selectedDate ? 'active' : ''}>
                  <span>{formatDay(day.date)}</span>
                  <i style={{ height: `${Math.max(5, Math.min(52, day.totalRainMm))}px`, background: RISK_COLORS[day.severity] }} />
                  <b>{formatNumber(day.totalRainMm, 1)}</b>
                  <small>มม.</small>
                </article>
              ))}
            </div>
          </section>

          <div className="impact-card-grid">
            {IMPACT_TYPES.map((type) => <ImpactCard key={type} item={plot.impacts[type]} />)}
          </div>
        </>
      )}

      <dl className="environment-provenance">
        <div><dt>แหล่งพยากรณ์</dt><dd>{forecast.source}</dd></div>
        <div><dt>โหมดข้อมูล</dt><dd>{forecast.mode}</dd></div>
        <div><dt>อัปเดต</dt><dd>{formatDateTime(forecast.updatedAt)}</dd></div>
        <div><dt>ความเชื่อมั่น</dt><dd>{forecast.confidenceLabel || (forecast.confidence ? `${Math.round(forecast.confidence * 100)}%` : '-')}</dd></div>
        <div><dt>การจับคู่พิกัด</dt><dd>{forecast.spatialMethod || '-'}</dd></div>
        <div><dt>น้ำขึ้นลง</dt><dd>{forecast.tideStatus || 'UNAVAILABLE'} — {forecast.tideReason || 'ไม่มีข้อมูล'}</dd></div>
      </dl>
    </section>
  );
}

export default function EnvironmentalIntelligence() {
  const [horizon, setHorizon] = useState('7d');
  const [riskFilter, setRiskFilter] = useState(ALL);
  const [impactFilter, setImpactFilter] = useState(ALL);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [selectedPlotKey, setSelectedPlotKey] = useState('');
  const [focusPlotKey, setFocusPlotKey] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [mapLayers, setMapLayers] = useState({ plots: true, rain: true, direction: true });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Mangrove Weather Intelligence | Live Forecast & GIS';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetchEnvironmentalOverview({
      horizon,
      forceRefresh: refreshToken > 0,
    }).then((result) => {
      if (!live) return;
      setOverview(result);
      const firstPlot = result.plots?.[0];
      setSelectedDate((current) => current || firstPlot?.forecast?.dailyRain?.[0]?.date || '');
      setSelectedPlotKey((current) => current || firstPlot?.plotKey || '');
      setLoading(false);
    }).catch((reason) => {
      if (!live) return;
      setError(reason.message);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [horizon, refreshToken]);

  const projects = useMemo(() => (
    [...new Map((overview?.plots || []).map((plot) => [plot.projectId, plot.projectName])).entries()]
      .map(([id, name]) => ({ id, name }))
  ), [overview]);

  const visiblePlots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (overview?.plots || [])
      .map((plot) => {
        const mapDay = getDailyForecast(plot, selectedDate);
        return {
          ...plot,
          mapDay,
          mapSeverity: mapDay?.severity || plot.forecast?.rainSeverity || 'UNKNOWN',
        };
      })
      .filter((plot) => projectFilter === ALL || plot.projectId === projectFilter)
      .filter((plot) => riskFilter === ALL || getMapSeverity(plot, selectedDate) === riskFilter)
      .filter((plot) => {
        const text = `${plot.plotId} ${plot.plotName} ${plot.province} ${plot.district} ${plot.subdistrict}`.toLowerCase();
        return !query || text.includes(query);
      })
      .sort((left, right) => (
        RISK_RANK[getMapSeverity(right, selectedDate)] - RISK_RANK[getMapSeverity(left, selectedDate)]
        || Number(getDailyForecast(right, selectedDate)?.totalRainMm || 0) - Number(getDailyForecast(left, selectedDate)?.totalRainMm || 0)
        || left.plotKey.localeCompare(right.plotKey)
      ));
  }, [overview, projectFilter, riskFilter, search, selectedDate]);

  const selectedPlot = overview?.plots.find((plot) => plot.plotKey === selectedPlotKey) || null;
  const summary = overview?.summary || {};
  const forecastDates = overview?.plots?.find((plot) => plot.forecast?.dailyRain?.length)?.forecast.dailyRain
    .map((day) => day.date) || [];
  const daySummary = useMemo(() => {
    const mapped = (overview?.plots || []).map((plot) => ({
      plot,
      day: getDailyForecast(plot, selectedDate),
    }));
    const count = (level) => mapped.filter(({ day }) => day?.severity === level).length;
    return {
      red: count('CRITICAL'),
      orange: count('HIGH'),
      yellow: count('MODERATE'),
      green: count('LOW'),
      maxRain: Math.max(0, ...mapped.map(({ day }) => Number(day?.totalRainMm || 0))),
    };
  }, [overview, selectedDate]);

  const toggleLayer = (layer) => {
    setMapLayers((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const selectPlot = (plotKey) => {
    setSelectedPlotKey(plotKey);
    setFocusPlotKey(plotKey);
  };

  return (
    <main className="environment-page">
      <header className="environment-hero">
        <div className="environment-hero-main">
          <div>
            <p className="eyebrow">Weather Operations Center · Mangrove Portfolio</p>
            <h1>ฝน พายุ และความเสี่ยงรายแปลง</h1>
            <p>ติดตามฝนล่วงหน้า 7 วัน ทิศทางแนวฝน พายุในภูมิภาค และขอบเขตพื้นที่ปลูกป่าทุกแปลงจากข้อมูล GIS เดิม</p>
          </div>
          <div className="mode-block">
            <span className={`live-data-badge ${overview?.mode === 'LIVE' ? 'is-live' : ''}`}>
              <Radio size={15} />{overview?.mode === 'LIVE' ? 'LIVE FORECAST' : overview?.mode || 'LOADING'}
            </span>
            <small>{overview?.source || 'กำลังเชื่อมต่อผู้ให้บริการ'}</small>
            <b>อัปเดต {formatDateTime(overview?.generatedAt)}</b>
          </div>
        </div>
        <div className="environment-toolbar">
          <div className="horizon-switcher" aria-label="ช่วงเวลาพยากรณ์">
            {[
              ['24h', '24 ชั่วโมง'],
              ['72h', '72 ชั่วโมง'],
              ['7d', '7 วัน'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={horizon === value ? 'active' : ''}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setHorizon(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              setRefreshToken((value) => value + 1);
            }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            ดึงข้อมูลล่าสุด
          </button>
        </div>
      </header>

      <section className="heuristic-notice">
        <ShieldAlert size={19} />
        <p><strong>สีเตือนฝนเป็นเกณฑ์ปฏิบัติการของระบบ</strong> ไม่ใช่ประกาศเตือนภัยของกรมอุตุนิยมวิทยา ส่วนชื่อพายุและระดับเตือนอ้างอิง GDACS โดยตรง</p>
      </section>

      {error ? (
        <section className="environment-error">
          <AlertTriangle size={24} />
          <h2>โหลดข้อมูลไม่สำเร็จ</h2>
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)}>ลองใหม่</button>
        </section>
      ) : (
        <>
          <StormBanner stormContext={overview?.stormContext} />

          <section className="environment-summary-grid" aria-label="สรุปความรุนแรงของฝนตามวันที่เลือก">
            <SummaryCard icon={MapPinned} label="ขอบเขตแปลง GIS" value={summary.total} tone="total" />
            <SummaryCard icon={AlertTriangle} label="ระดับแดง" value={daySummary.red} tone="critical" />
            <SummaryCard icon={ShieldAlert} label="ระดับส้ม" value={daySummary.orange} tone="high" />
            <SummaryCard icon={Waves} label="ระดับเหลือง" value={daySummary.yellow} tone="moderate" />
            <SummaryCard icon={CloudRain} label="ระดับเขียว" value={daySummary.green} tone="low" />
            <SummaryCard icon={Activity} label="ฝนสูงสุดรายแปลง" value={daySummary.maxRain} suffix=" มม." tone="inspection" />
          </section>

          <RainDayStrip dates={forecastDates} selectedDate={selectedDate} onSelect={setSelectedDate} />

          <section className="environment-workspace">
            <div className="environment-map-panel">
              <header className="panel-heading">
                <div>
                  <p className="section-label">Forecast severity map · {formatDay(selectedDate)}</p>
                  <h2>ฝนและขอบเขตแปลงปลูก</h2>
                </div>
                <div className="map-layer-controls">
                  <button type="button" className={mapLayers.plots ? 'active' : ''} onClick={() => toggleLayer('plots')}><Layers size={13} />แปลงปลูก</button>
                  <button type="button" className={mapLayers.rain ? 'active' : ''} onClick={() => toggleLayer('rain')}><CloudRain size={13} />พยากรณ์อากาศ</button>
                  <button type="button" className={mapLayers.direction ? 'active' : ''} onClick={() => toggleLayer('direction')}><Navigation size={13} />ทิศทาง</button>
                </div>
              </header>
              <div className="map-legend-bar">
                <span><i className="severity-green" />เขียว · ปกติ</span>
                <span><i className="severity-yellow" />เหลือง · เฝ้าระวัง</span>
                <span><i className="severity-orange" />ส้ม · เสี่ยงสูง</span>
                <span><i className="severity-red" />แดง · รุนแรง</span>
                <small>ซูมไกลสรุปรายจังหวัด · ซูมเข้าแสดงรายแปลง</small>
              </div>
              {loading ? <div className="environment-loading">กำลังดึงพยากรณ์และประมวลผล 129 แปลง...</div> : (
                <EnvironmentalMap
                  plots={visiblePlots}
                  selectedPlotKey={selectedPlotKey}
                  focusPlotKey={focusPlotKey}
                  selectedDate={selectedDate}
                  layers={mapLayers}
                  onSelect={selectPlot}
                />
              )}
            </div>
            <PlotDetail plot={selectedPlot} selectedDate={selectedDate} />
          </section>

          <section className="priority-section">
            <header className="priority-header">
              <div><p className="section-label">Plot-level forecast operations</p><h2>แปลงที่ควรติดตามก่อน</h2></div>
              <span>{visiblePlots.length} จาก {summary.total || 0} แปลง · {formatDay(selectedDate)}</span>
            </header>
            <div className="environment-filters">
              <label><span>โครงการ</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value={ALL}>ทุกโครงการ</option>
                {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select></label>
              <label><span>ระดับฝน</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                <option value={ALL}>ทุกระดับ</option>
                {Object.entries(RISK_LABELS).map(([level, label]) => <option value={level} key={level}>{label}</option>)}
              </select></label>
              <label><span>มุมมองผลกระทบ</span><select value={impactFilter} onChange={(event) => setImpactFilter(event.target.value)}>
                {Object.entries(IMPACT_LABELS).map(([type, label]) => <option value={type} key={type}>{label}</option>)}
              </select></label>
              <label className="search-field"><span>ค้นหาแปลง</span><div><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="รหัสแปลง / จังหวัด / อำเภอ" /></div></label>
            </div>
            <div className="priority-table-wrap">
              <table className="priority-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th><th>แปลง / โครงการ</th><th>พื้นที่</th><th>ระดับฝน</th>
                    <th>ฝนสะสม</th><th>ฝนเริ่ม</th><th>หนักสุด</th><th>ทิศทางแนวฝน</th><th>ผลกระทบ</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlots.map((plot, index) => {
                    const day = getDailyForecast(plot, selectedDate);
                    const severity = getMapSeverity(plot, selectedDate);
                    const impact = plot.impacts[impactFilter === ALL ? 'FIELD' : impactFilter];
                    return (
                      <tr
                        key={plot.plotKey}
                        className={selectedPlotKey === plot.plotKey ? 'selected' : ''}
                        onClick={() => selectPlot(plot.plotKey)}
                      >
                        <td>{index + 1}</td>
                        <td><strong>{plot.plotName}</strong><span>{plot.projectName}</span></td>
                        <td>{plot.province || 'ไม่ระบุจังหวัด'}</td>
                        <td><RiskBadge level={severity} compact /></td>
                        <td><b>{formatNumber(day?.totalRainMm, 1)}</b> มม.</td>
                        <td><Timer size={12} /> {formatTime(day?.rainOnsetAt)}</td>
                        <td>{formatTime(day?.peakRainAt)} · {formatNumber(day?.peakRainMmPerHour, 1)} มม./ชม.</td>
                        <td><Navigation size={12} /> {day?.rainOnsetAt ? plot.forecast?.rainMovementTowardLabel : '-'}</td>
                        <td><RiskBadge level={impact?.level || 'UNKNOWN'} compact label={impactFilter === ALL ? 'ลงพื้นที่' : IMPACT_LABELS[impactFilter]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visiblePlots.length && <div className="empty-results">ไม่พบแปลงตามตัวกรองนี้</div>}
            </div>
          </section>

          <footer className="environment-sources">
            <Database size={15} />
            <span>พยากรณ์: Open‑Meteo Forecast API · พายุ: GDACS / European Commission · ขอบเขตแปลง: Shapefile เดิม 129 แปลง</span>
          </footer>
        </>
      )}
    </main>
  );
}
