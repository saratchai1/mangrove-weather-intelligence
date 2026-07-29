import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  Download,
  Layers,
  Map,
  MousePointer2,
  Trees,
} from 'lucide-react';
import EarthFlight from './EarthFlight';
import { projects } from './portfolioData';
import { getRepresentativePoint } from './utils/geometry';

const STATUS_COLORS = {
  Passed: '#15803d',
  Incomplete: '#d97706',
  Fail: '#dc2626',
  'On going': '#64748b',
  Unknown: '#94a3b8',
};

const STATUS_THAI = {
  Passed: 'ผ่านเกณฑ์',
  Incomplete: 'ต้องดำเนินการเพิ่ม',
  Fail: 'ไม่ผ่านเกณฑ์',
  'On going': 'รอตรวจนับ',
  Unknown: 'ไม่มีข้อมูล',
};

const STATUS_ORDER = ['Fail', 'Incomplete', 'On going', 'Passed'];
const ALL_STATUS = 'ทั้งหมด';
const WORLD_START_CENTER = [39.5, -98.35];
const WORLD_START_ZOOM = 2;
const PLOT_FLYTO_MAX_ZOOM = 16;
const WORKPLAN_STATUS = {
  C: 'Complete',
  O: 'On going',
  D: 'Delay',
  I: 'In progress',
};

const WORKPLAN_PROJECT_KEYS = {
  'g1-wisutti': 'MOC 1-VSD premium',
  'g1-siam-tc': 'MOC 1-STC premium',
  'g2-wisutti': 'Standard กลุ่ม 2 VSD',
  'g2-siam-tc': 'Standard กลุ่ม 2 STC',
};

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined) return '-';
  return `${formatNumber(value, 2)}%`;
}

function worstStatus(records) {
  const statuses = records.map((record) => record?.statusAfter).filter(Boolean);
  return STATUS_ORDER.find((status) => statuses.includes(status)) || statuses[0] || 'Unknown';
}

function weightedSurvival(records) {
  const usable = records.filter((record) => record?.survivalAfterPercent !== null && record?.survivalAfterPercent !== undefined);
  const weighted = usable.filter((record) => Number(record.plantedAreaRai) > 0);
  if (weighted.length) {
    const totalArea = weighted.reduce((sum, record) => sum + Number(record.plantedAreaRai), 0);
    return weighted.reduce((sum, record) => (
      sum + (Number(record.survivalAfterPercent) * Number(record.plantedAreaRai))
    ), 0) / totalArea;
  }
  if (!usable.length) return null;
  return usable.reduce((sum, record) => sum + Number(record.survivalAfterPercent), 0) / usable.length;
}

function getPlotIds(plot) {
  return plot.officialPlotIds?.length ? plot.officialPlotIds : [plot.plotId];
}

function enrichFeature(feature, registry) {
  const records = getPlotIds(feature.properties)
    .map((plotId) => registry?.byId?.[plotId])
    .filter(Boolean);
  return {
    ...feature,
    properties: {
      ...feature.properties,
      survivalRecords: records,
      twinStatus: worstStatus(records),
      twinSurvivalPercent: weightedSurvival(records),
    },
  };
}

function StatusBadge({ status }) {
  return (
    <span className="twin-status-badge">
      <i style={{ background: STATUS_COLORS[status] || STATUS_COLORS.Unknown }} />
      {STATUS_THAI[status] || status}
    </span>
  );
}

function DigitalTwinMap({ features, sampleGeojson, selectedPlotId, onSelectPlot }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const areaLayerRef = useRef(null);
  const sampleLayerRef = useRef(null);
  const featureLayersRef = useRef({});
  const onSelectRef = useRef(onSelectPlot);
  const previousSelectedPlotRef = useRef(selectedPlotId);
  const [isEarthFlight, setIsEarthFlight] = useState(false);

  const selectedFeature = useMemo(
    () => features.find((feature) => feature.properties.plotId === selectedPlotId),
    [features, selectedPlotId],
  );
  const destination = useMemo(
    () => (selectedFeature ? getRepresentativePoint(selectedFeature) : { lat: 39.5, lng: -98.35 }),
    [selectedFeature],
  );

  useEffect(() => {
    onSelectRef.current = onSelectPlot;
  }, [onSelectPlot]);

  useEffect(() => {
    const previousSelection = previousSelectedPlotRef.current;
    previousSelectedPlotRef.current = selectedPlotId;

    if (!selectedPlotId) {
      const frame = window.requestAnimationFrame(() => setIsEarthFlight(false));
      return () => window.cancelAnimationFrame(frame);
    }

    if (previousSelection === selectedPlotId) return undefined;

    setIsEarthFlight(true);
    const timer = window.setTimeout(() => setIsEarthFlight(false), 2600);
    return () => window.clearTimeout(timer);
  }, [selectedPlotId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      areaLayerRef.current = null;
      sampleLayerRef.current = null;
      featureLayersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (areaLayerRef.current) areaLayerRef.current.remove();
    if (sampleLayerRef.current) sampleLayerRef.current.remove();
    featureLayersRef.current = {};

    if (!features.length) return;

    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: (feature) => {
        const status = feature.properties.twinStatus;
        const tentative = feature.properties.plotMatchStatus?.includes('tentative');
        return {
          color: status === 'Fail' ? '#7f1d1d' : '#064e3b',
          weight: feature.properties.plotId === selectedPlotId ? 3 : 1.25,
          dashArray: tentative ? '6 5' : null,
          fillColor: STATUS_COLORS[status] || STATUS_COLORS.Unknown,
          fillOpacity: feature.properties.plotId === selectedPlotId ? 0.46 : 0.26,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const plot = feature.properties;
        const qaText = plot.plotMatchStatus?.includes('tentative') ? '<br><em>Tentative geometry</em>' : '';
        featureLayersRef.current[plot.plotId] = featureLayer;
        featureLayer.bindTooltip(
          `<strong>${plot.plotId}</strong><br>${plot.province} · ${STATUS_THAI[plot.twinStatus] || plot.twinStatus}<br>${formatPercent(plot.twinSurvivalPercent)}${qaText}`,
          { sticky: true },
        );
        featureLayer.on('click', () => onSelectRef.current(plot.plotId));
      },
    }).addTo(map);

    if (sampleGeojson?.features?.length) {
      sampleLayerRef.current = L.geoJSON(sampleGeojson, {
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
          radius: 4,
          color: '#8c5b00',
          weight: 1,
          fillColor: '#f2c95c',
          fillOpacity: 0.92,
        }),
      }).addTo(map);
    }

    areaLayerRef.current = layer;
    const selectedLayer = selectedPlotId ? featureLayersRef.current[selectedPlotId] : null;
    if (selectedLayer) {
      selectedLayer.bringToFront();
      requestAnimationFrame(() => {
        map.invalidateSize();
        map.flyToBounds(selectedLayer.getBounds(), { padding: [28, 28], maxZoom: PLOT_FLYTO_MAX_ZOOM });
      });
    } else {
      map.setView(WORLD_START_CENTER, WORLD_START_ZOOM);
    }
  }, [features, sampleGeojson, selectedPlotId]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = areaLayerRef.current;
    if (!map || !layer) return;

    layer.setStyle((feature) => {
      const selected = feature.properties.plotId === selectedPlotId;
      const status = feature.properties.twinStatus;
      const tentative = feature.properties.plotMatchStatus?.includes('tentative');
      return {
        color: selected ? '#fbbf24' : (status === 'Fail' ? '#7f1d1d' : '#064e3b'),
        weight: selected ? 3.2 : 1.25,
        dashArray: tentative ? '6 5' : null,
        fillColor: selected ? '#f59e0b' : (STATUS_COLORS[status] || STATUS_COLORS.Unknown),
        fillOpacity: selected ? 0.5 : 0.26,
      };
    });

    const selectedLayer = featureLayersRef.current[selectedPlotId];
    if (selectedLayer) {
      selectedLayer.bringToFront();
      requestAnimationFrame(() => {
        map.invalidateSize();
        map.flyToBounds(selectedLayer.getBounds(), { padding: [28, 28], maxZoom: PLOT_FLYTO_MAX_ZOOM });
      });
    } else {
      map.setView(WORLD_START_CENTER, WORLD_START_ZOOM);
    }
  }, [selectedPlotId]);

  const showEarth = !selectedPlotId || isEarthFlight;

  return (
    <div className={`twin-map-frame ${selectedPlotId ? 'has-plot' : 'globe-start'} ${isEarthFlight ? 'earth-flight' : ''}`}>
      <div
        className={`twin-map-canvas ${selectedPlotId ? 'is-plot-view' : 'is-globe-start'}`}
        ref={containerRef}
        aria-label="Digital twin map"
      />
      {showEarth && (
        <div className="twin-globe-stage" aria-label="Globe centered on the United States">
          <EarthFlight
            destination={destination}
            flightActive={isEarthFlight}
            selectedPlotId={selectedPlotId}
          />
          <div className="twin-globe-caption">
            <strong>เลือกแปลงจากรายการด้านขวา</strong>
            <span>จากมุมมองโลก แล้วระบบจะซูมเข้าแปลงด้วยภาพถ่ายดาวเทียม</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlotPanel({ feature, project, workplanRecords = [] }) {
  if (!feature) {
    return (
      <section className="twin-plot-panel empty">
        <MousePointer2 size={18} />
        <p>เลือก polygon หรือรายการแปลง เพื่อเปิด digital twin card ของแปลงนั้น</p>
      </section>
    );
  }

  const plot = feature.properties;
  const records = plot.survivalRecords;
  const officialIds = getPlotIds(plot);
  const area = records.reduce((sum, record) => sum + Number(record.areaRai || 0), 0);
  const plantedArea = records.reduce((sum, record) => sum + Number(record.plantedAreaRai || 0), 0);
  const transitions = [...new Set(records.map((record) => record.transition).filter(Boolean))];
  const workplanProgress = workplanRecords.length
    ? workplanRecords.reduce((sum, record) => sum + Number(record.progressPercent || 0), 0) / workplanRecords.length
    : null;

  return (
    <section className="twin-plot-panel">
      <div className="plot-panel-top">
        <div>
          <p className="section-label">Twin Card</p>
          <h2>{plot.plotId}</h2>
          {officialIds.length > 1 && <span>รวมแปลงทางการ: {officialIds.join(', ')}</span>}
        </div>
        <StatusBadge status={plot.twinStatus} />
      </div>

      <div className="plot-kpi">
        <div>
          <span>อัตรารอดตายล่าสุด</span>
          <strong>{formatPercent(plot.twinSurvivalPercent)}</strong>
        </div>
        <div>
          <span>พื้นที่ workbook</span>
          <strong>{formatNumber(area || plot.officialParticipatingAreaRai, 2)} ไร่</strong>
        </div>
        <div>
          <span>พื้นที่ปลูกจริง</span>
          <strong>{formatNumber(plantedArea, 2)} ไร่</strong>
        </div>
      </div>

      <dl className="plot-dl">
        <div><dt>โครงการ</dt><dd>{project.shortName}</dd></div>
        <div><dt>จังหวัด</dt><dd>{plot.province}</dd></div>
        <div><dt>ตำบล / อำเภอ</dt><dd>{plot.subdistrict || '-'} / {plot.district || '-'}</dd></div>
        <div><dt>สถานะก่อนอัปเดต</dt><dd>{records.map((record) => record.statusBefore).filter(Boolean).join(', ') || '-'}</dd></div>
        <div><dt>การเปลี่ยนสถานะ</dt><dd>{transitions.join(', ') || '-'}</dd></div>
        <div><dt>พื้นที่ polygon</dt><dd>{formatNumber(plot.geometryAreaRai, 2)} ไร่</dd></div>
        {plot.plotMatchStatus?.includes('tentative') && (
          <div><dt>Geometry QA</dt><dd>Tentative จากจุดหมุด DBF</dd></div>
        )}
      </dl>

      {workplanRecords.length > 0 && (
        <section className="workplan-card">
          <p className="section-label">Year 2 Workplan</p>
          <div className="workplan-kpi">
            <strong>{formatPercent(workplanProgress)}</strong>
            <span>{workplanRecords.map((record) => WORKPLAN_STATUS[record.statusCode] || record.status || record.statusCode).join(', ')}</span>
          </div>
          <div className="workplan-periods">
            {workplanRecords.flatMap((record) => record.periods).map((period, index) => (
              <div key={`${period.period}-${index}`}>
                <b>งวด {period.period}</b>
                <span>{period.start || '-'} ถึง {period.end || '-'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function CoverageNotice({ mapProject, appProject }) {
  const coverage = mapProject?.spatialCoverage;
  if (!coverage) return null;

  if (coverage.verifiedPlotCrosswalkCount !== undefined) {
    return (
      <section className="twin-coverage">
        <AlertTriangle size={18} />
        <div>
          <strong>G2 Siam TC ใช้ geometry จาก preview และมี crosswalk บางส่วนเป็น tentative</strong>
          <p>
            มี footprint {coverage.footprintFeatureCount} layers; ยืนยันรหัสแปลงแล้ว {coverage.verifiedPlotCrosswalkCount} แปลง
            และจับคู่แบบ tentative {coverage.tentativePlotCrosswalkCount} แปลงจากจังหวัด/พื้นที่ใกล้ที่สุด
          </p>
        </div>
      </section>
    );
  }

  if (coverage.tentativeFootprintPlotIds?.length) {
    return (
      <section className="twin-coverage">
        <AlertTriangle size={18} />
        <div>
          <strong>ชั้นแผนที่ของ {appProject.shortName} แสดงครบทุกแปลงแล้ว แต่มี geometry บางส่วนเป็น tentative</strong>
          <p>
            แสดง {coverage.mappedOfficialPlotCount} จาก {mapProject.plotCount} แปลงทางการ;
            แปลง {coverage.tentativeFootprintPlotIds.join(', ')} ถูกสร้างจากจุดหมุดใน DBF
            เพราะไฟล์ area .shp ต้นฉบับหายไป
          </p>
        </div>
      </section>
    );
  }

  if (!coverage.missingFootprintPlotIds?.length) return null;

  return (
    <section className="twin-coverage">
      <AlertTriangle size={18} />
      <div>
        <strong>ชั้นแผนที่ของ {appProject.shortName} ยังมี geometry ไม่ครบทุกแปลง</strong>
        <p>
          แสดง polygon สำหรับ {coverage.mappedOfficialPlotCount} จาก {mapProject.plotCount} แปลงทางการ
          และยังไม่วาดแปลงที่ขาด shapefile: {coverage.missingFootprintPlotIds.join(', ')}
        </p>
      </div>
    </section>
  );
}

function ProjectUnavailable({ project, onBack }) {
  return (
    <main className="dashboard twin-shell">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        กลับหน้ารวม
      </button>
      <section className="twin-unavailable">
        <Database size={28} />
        <p className="eyebrow">Spatial layer pending</p>
        <h1>{project.shortName} ยังไม่มีชั้นแผนที่ที่ยืนยันในเว็บ map หลัก</h1>
        <p>
          dashboard ยังแสดง metric และสถานะรอดตายของโครงการนี้ครบแล้ว
          แต่จะไม่ดึง preview/QA layer เข้ามาปนจนกว่า geometry จะถูก merge เข้า map หลัก
        </p>
      </section>
    </main>
  );
}

function SpatialTwin({
  activeProjectId,
  onProjectChange,
  selectedPlotId,
  onSelectedPlotChange,
  statusFilter,
  onStatusFilterChange,
  onBack,
}) {
  const [mapProject, setMapProject] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [sampleGeojson, setSampleGeojson] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [workplan, setWorkplan] = useState(null);
  const [province, setProvince] = useState(ALL_STATUS);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const appProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const spatialProjects = projects.filter((project) => project.spatialAvailable);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch('/data/survival-plots.json').then((response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลด survival registry ได้');
        return response.json();
      }),
      fetch('/data/year2-workplan.json').then((response) => {
        if (!response.ok) return null;
        return response.json();
      }),
    ])
      .then(([survivalData, workplanData]) => {
        if (!live) return;
        setRegistry(survivalData);
        setWorkplan(workplanData);
      })
      .catch((reason) => {
        if (live) setError(reason.message);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!appProject.spatialAvailable) return undefined;
    let live = true;
    const root = `/data/${activeProjectId}`;
    const sampleRequest = fetch(`${root}/sample-plots.geojson`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);

    Promise.all([
      fetch(`${root}/project.json`).then((response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลด metadata แผนที่ได้');
        return response.json();
      }),
      fetch(`${root}/planting-areas.geojson`).then((response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลด geometry แผนที่ได้');
        return response.json();
      }),
      sampleRequest,
    ])
      .then(([projectData, geometryData, sampleData]) => {
        if (!live) return;
        setMapProject(projectData);
        setGeojson(geometryData);
        setSampleGeojson(sampleData);
      })
      .catch((reason) => {
        if (live) setError(reason.message);
      });

    return () => {
      live = false;
    };
  }, [activeProjectId, appProject.spatialAvailable]);

  const enrichedFeatures = useMemo(() => {
    if (!geojson || !registry) return [];
    return geojson.features.map((feature) => enrichFeature(feature, registry));
  }, [geojson, registry]);

  const provinces = useMemo(() => (
    [...new Set(enrichedFeatures.map((feature) => feature.properties.province).filter(Boolean))].sort()
  ), [enrichedFeatures]);

  const visibleFeatures = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrichedFeatures.filter(({ properties: plot }) => {
      const statusMatch = statusFilter === ALL_STATUS || plot.twinStatus === statusFilter;
      const provinceMatch = province === ALL_STATUS || plot.province === province;
      const text = `${plot.plotId} ${getPlotIds(plot).join(' ')} ${plot.province} ${plot.subdistrict} ${plot.district}`.toLowerCase();
      return statusMatch && provinceMatch && (!query || text.includes(query));
    });
  }, [enrichedFeatures, province, search, statusFilter]);

  const selectedFeature = enrichedFeatures.find((feature) => feature.properties.plotId === selectedPlotId);
  const selectedWorkplanRecords = selectedFeature
    ? getPlotIds(selectedFeature.properties).map((plotId) => workplan?.byId?.[plotId]).filter(Boolean)
    : [];
  const workplanProject = workplan?.projectSummary?.[WORKPLAN_PROJECT_KEYS[activeProjectId]];
  const visibleArea = visibleFeatures.reduce((sum, feature) => sum + Number(feature.properties.officialParticipatingAreaRai || 0), 0);

  if (!appProject.spatialAvailable) {
    return <ProjectUnavailable project={appProject} onBack={onBack} />;
  }

  if (error) {
    return (
      <main className="dashboard twin-shell">
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          กลับหน้ารวม
        </button>
        <section className="twin-unavailable">
          <AlertTriangle size={28} />
          <h1>โหลด Digital Twin ไม่สำเร็จ</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  const loading = !mapProject || mapProject.id !== activeProjectId || !geojson || !registry || !workplan;

  return (
    <main className="dashboard twin-shell">
      <header className="twin-hero">
        <nav className="twin-nav">
          <button className="back-link" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            กลับหน้ารวม
          </button>
          <div className="twin-project-switcher" aria-label="เลือกโครงการบนแผนที่">
            {spatialProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={project.id === activeProjectId ? 'active' : ''}
                onClick={() => onProjectChange(project.id)}
              >
                {project.shortName}
              </button>
            ))}
          </div>
        </nav>

        <div className="twin-hero-grid">
          <section>
            <p className="eyebrow">Spatial Digital Twin</p>
            <h1>{appProject.name}</h1>
            <p>
              เชื่อมข้อมูล PDD, geometry จากเว็บ map และผลรอดตายล่าสุดระดับแปลง
              เพื่อให้เห็นทั้ง “พื้นที่จริง” และ “สถานะตรวจติดตาม” ในมุมเดียว
            </p>
          </section>
          <aside className="twin-summary-card">
            <Map size={20} />
            <strong>{loading ? '-' : formatNumber(enrichedFeatures.length)}</strong>
            <span>map layers ที่เชื่อม survival registry แล้ว</span>
          </aside>
        </div>
      </header>

      <section className="twin-metrics">
        <article>
          <Trees size={18} />
          <span>พื้นที่ PDD</span>
          <strong>{formatNumber(appProject.area, 2)} ไร่</strong>
        </article>
        <article>
          <Layers size={18} />
          <span>พื้นที่ที่เห็นใน filter</span>
          <strong>{formatNumber(visibleArea, 2)} ไร่</strong>
        </article>
        <article>
            <Database size={18} />
            <span>Year 2 progress</span>
            <strong>{formatNumber(workplanProject?.weightedProgressPercent, 2)}%</strong>
        </article>
        <article>
          <Download size={18} />
          <span>ไฟล์ spatial</span>
          <a href={`/data/${activeProjectId}/planting-areas.geojson`} download>
            GeoJSON
          </a>
        </article>
      </section>

      <CoverageNotice mapProject={mapProject} appProject={appProject} />

      <section className="twin-workspace">
        <div className="twin-map-panel">
          <div className="twin-panel-title">
            <div>
              <p className="section-label">แผนที่รายแปลง</p>
              <h2>พื้นที่โครงการ</h2>
            </div>
            <div className="twin-legend">
              {Object.entries(STATUS_THAI).filter(([status]) => status !== 'Unknown').map(([status, label]) => (
                <span key={status}><i style={{ background: STATUS_COLORS[status] }} />{label}</span>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="twin-loading">กำลังประกอบ geometry + survival registry...</div>
          ) : (
            <DigitalTwinMap
              features={visibleFeatures}
              sampleGeojson={sampleGeojson}
              selectedPlotId={selectedPlotId}
              onSelectPlot={onSelectedPlotChange}
            />
          )}
        </div>

        <aside className={`twin-sidebar ${selectedFeature ? 'has-selection' : ''}`}>
          <section className="twin-directory">
            <div className="directory-heading">
              <h2>รายการแปลง</h2>
              <span>{visibleFeatures.length} layers</span>
            </div>
            <div className="twin-filters">
              <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                <option>{ALL_STATUS}</option>
                <option>Passed</option>
                <option>Incomplete</option>
                <option>Fail</option>
                <option>On going</option>
              </select>
              <select value={province} onChange={(event) => setProvince(event.target.value)}>
                <option>{ALL_STATUS}</option>
                {provinces.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหารหัสแปลง/ตำบล"
              />
            </div>
            <div className="twin-plot-list">
              {visibleFeatures.map(({ properties: plot }) => (
                <button
                  key={plot.plotId}
                  data-plot-id={plot.plotId}
                  type="button"
                  className={selectedPlotId === plot.plotId ? 'active' : ''}
                  onPointerUp={() => onSelectedPlotChange(plot.plotId)}
                  onClick={() => onSelectedPlotChange(plot.plotId)}
                >
                  <span>
                    <strong>{plot.plotId}</strong>
                    <em>{plot.province}</em>
                  </span>
                  <StatusBadge status={plot.twinStatus} />
                  <b>{formatPercent(plot.twinSurvivalPercent)}</b>
                </button>
              ))}
            </div>
          </section>

          <PlotPanel feature={selectedFeature} project={appProject} workplanRecords={selectedWorkplanRecords} />
        </aside>
      </section>
    </main>
  );
}

export { ALL_STATUS };
export default SpatialTwin;
