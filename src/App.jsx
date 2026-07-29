import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  BookCheck,
  Building2,
  CheckCircle2,
  CloudRain,
  FileSpreadsheet,
  Satellite,
  Leaf,
  MapPinned,
  ShieldAlert,
  Sprout,
  Target,
  Trees,
} from 'lucide-react';
import SpatialTwin, { ALL_STATUS } from './SpatialTwin';
import Year2WarRoom from './Year2WarRoom';
import EnvironmentalIntelligence from './EnvironmentalIntelligence';
import {
  adjustedSummary,
  changeSummary,
  failPlots,
  incompleteBands,
  portfolio,
  projects,
  statusSummary,
} from './portfolioData';
import './App.css';

const STATUS_COLORS = {
  Passed: '#15803d',
  Incomplete: '#d97706',
  Fail: '#dc2626',
  'On going': '#64748b',
};

const STATUS_THAI = {
  Passed: 'ผ่านเกณฑ์',
  Incomplete: 'ต้องดำเนินการเพิ่ม',
  Fail: 'ไม่ผ่านเกณฑ์',
  'On going': 'รอตรวจนับ',
};

const year2Highlights = {
  weightedProgress: 48.53,
  planProgress: 79.41,
  actualProgress: 56.33,
  progressGap: 23.08,
  delayedPlots: 107,
  activePlots: 151,
  holdPlots: 9,
  remainingArea: 10230.4,
  topProvinces: 'พังงา, กระบี่, ชุมพร',
  topRiskPlot: '18-VSD',
  topRiskRemaining: 1527.82,
};

function formatNumber(value, decimals = 0) {
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status.toLowerCase().replace(' ', '-')}`}>
      <span />
      {STATUS_THAI[status]}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, unit, detail, accent = 'forest' }) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <p>{label}</p>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

const reportPages = {
  legacy: {
    eyebrow: 'Legacy dashboard',
    title: 'Mangrove Carbon Management',
    description: 'เวอร์ชั่น dashboard demo เก่าที่เคยทำไว้ นำกลับมาเป็น tab ย่อยเพื่อเทียบกับ dashboard ปัจจุบัน',
    src: '/legacy-dashboard.html',
  },
  insight: {
    eyebrow: 'Insight',
    title: 'Executive Insight แผนงานปีที่ 2',
    description: 'นำ preview dashboard มาไว้เป็นหน้าใหม่ใน dashboard หลัก โดยไม่ทับหน้าเดิม',
    src: '/insight.html',
  },
  satellite: {
    eyebrow: 'Satellite screening',
    title: 'ภาพถ่ายดาวเทียมและ readiness QA',
    description: 'เวอร์ชั่น 2 มิ.ย. 2569 พร้อม tide QA, GEE intake และ segment readiness ล่าสุด',
    src: '/satellite-screening/index.html',
  },
  seg014Internal: {
    eyebrow: 'SEG014 internal',
    title: 'SEG014 แดชบอร์ดคัดกรองภาพดาวเทียมภายใน',
    description: 'dashboard เฉพาะ SEG014 สำหรับดูคู่เวลา ดัชนีภาพ และ caveat ภายในก่อนใช้วางแผน technical review',
    src: '/seg014-internal-dashboard/seg014_internal_dashboard.html',
  },
  nursery: {
    eyebrow: 'Nursery habitat',
    title: 'Nursery Habitat Potential Index สำหรับผู้บริหาร',
    description: 'แผนที่และคะแนนคัดกรองว่าแปลงไหนน่าไปตรวจศักยภาพแหล่งอนุบาลสัตว์น้ำก่อน โดยยังไม่ claim ว่ามีสัตว์น้ำแล้ว',
    src: '/nursery-habitat/index.html',
  },
  coastalVulnerability: {
    eyebrow: 'Coastal risk',
    title: 'Coastal Risk Screening: จุดชายฝั่งที่ควรตรวจจริงก่อน',
    description: 'แปลผล InVEST/sensitivity เป็นแผนที่ผู้บริหาร ว่าจุดไหนโมเดลชี้ว่าควรลงตรวจ shoreline evidence ก่อน',
    src: '/coastal-vulnerability/index.html',
  },
  coastalExecutive: {
    eyebrow: 'Executive report',
    title: 'รายงานฉบับผู้บริหาร: Coastal Vulnerability',
    description: 'สรุปผล InVEST v6 จาก ERA5 wave, DMR geomorphology และ shore points สำหรับคัดกรอง hotspot และอธิบายข้อจำกัดการ claim impact',
    src: '/coastal-vulnerability-executive/index.html',
  },
  coastalPopulation: {
    eyebrow: 'Population risk V3',
    title: 'Population Risk V3: จุดเสี่ยงที่ใกล้คน ชุมชน และสินทรัพย์',
    description: 'แผนที่ซูมได้จาก WorldPop, OSM, GHSL และ ESA เพื่อดู hotspot ที่อยู่ใกล้คนและ built-up จริง',
    src: '/coastal-population-exposure/index.html',
  },
  habitatQuality: {
    eyebrow: 'Habitat quality screening',
    title: 'Habitat Quality Screening V1',
    description: 'คัดกรองคุณภาพ habitat จาก water/coast/patch/readiness และ proxy สิ่งกดดันจากอาคาร/ถนนใกล้แปลง',
    src: '/habitat-quality-screening/index.html',
  },
  claimReadiness: {
    eyebrow: 'Claim readiness',
    title: 'Claim-Readiness Matrix',
    description: 'ตารางแยกว่าแต่ละ narrative ตอนนี้พูดได้แค่ไหน ห้ามพูดอะไร และต้องเติมหลักฐานอะไรเพื่อเลื่อนระดับ claim',
    src: '/claim-readiness/index.html',
  },
  habitatRiskV2: {
    eyebrow: 'Habitat risk V3',
    title: 'Habitat Quality / HRA V3 จาก OSM + GHSL + ESA',
    description: 'คัดกรอง habitat และ threat รอบแปลงด้วย OSM, GHSL BuiltSurface 2020 และ ESA WorldCover 2021 official raster',
    src: '/habitat-risk-v3/index.html',
  },
  builtupRisk: {
    eyebrow: 'Built-up risk V3',
    title: 'Population + Built-up / Asset Context จาก GHSL + ESA',
    description: 'ยกระดับ population exposure จาก “ใกล้คน” เป็น “ใกล้ชุมชน/สินทรัพย์” ด้วย WorldPop, OSM, GHSL BuiltSurface และ ESA WorldCover',
    src: '/builtup-population-risk-v3/index.html',
  },
  blueCarbon: {
    eyebrow: 'Blue carbon screening',
    title: 'Blue Carbon Screening จาก GEE',
    description: 'คัดกรองแปลงที่ควรเข้า blue carbon monitoring ต่อจาก ESA WorldCover และ Dynamic World โดยยังไม่ใช่ carbon credit claim',
    src: '/blue-carbon-screening/index.html',
  },
  fieldPack: {
    eyebrow: 'Field validation',
    title: 'Field Validation Pack พร้อมตำแหน่งพื้นที่คร่าว ๆ',
    description: 'ชุดลงสนาม 65 เป้าหมาย พร้อมจังหวัด/อำเภอ/ตำบลจาก OSM reverse geocode เพื่อช่วยวางแผนเบื้องต้น',
    src: '/field-validation-pack/index.html',
  },
  executiveUpdate: {
    eyebrow: 'Executive update',
    title: 'สรุปผู้บริหาร: A+B Screening Update',
    description: 'สรุปสิ่งที่รู้เพิ่มจาก coastal risk, population exposure, nursery และ habitat quality พร้อมข้อจำกัดก่อน claim impact',
    src: '/executive-ab-update/index.html',
  },
  nonCarbon: {
    eyebrow: 'Non-carbon impact',
    title: 'สรุปผลกระทบที่ไม่ใช่คาร์บอน',
    description: 'รายงานหลักฐานเชิงพื้นที่ที่เชื่อม DSAS, satellite screening และข้อจำกัดการกล่าวอ้าง',
    src: '/non-carbon-impact/index.html',
  },
  glossary: {
    eyebrow: 'Executive glossary',
    title: 'คำศัพท์ใน dashboard ที่ผู้บริหารอาจไม่คุ้น',
    description: 'แปลคำเทคนิค เช่น OSM, GHSL, ESA, InVEST, screening และ claim ให้เป็นภาษาง่าย',
    src: '/executive-glossary/index.html',
  },
};

const evidenceUpdates = [
  {
    label: 'Tide QA',
    value: '41/41 ready',
    detail: 'ปิดคอขวดระดับน้ำแล้ว รวม MD04 แม่กลองสำหรับ SEG025/SEG027 baseline และ MD14 archive proxy ของ SEG012',
  },
  {
    label: 'SEG025 / SEG027',
    value: 'Baseline ready',
    detail: '2018 baseline replacement ผ่าน imagery + tide gate และเปิด cautious with baseline review ครบ 2020/21, 2023/24, 2025/26',
  },
  {
    label: 'SEG012',
    value: 'Human QA done',
    detail: 'baseline เดิมไม่ใช้, 2020/21 ใช้แบบระวัง, 2023/24 ผ่านดี และมี GEE composite 2018 เป็น context เพิ่ม',
  },
  {
    label: 'Claim status',
    value: 'Screening only',
    detail: 'ใช้คัดกรองและจัดลำดับตรวจสอบได้ แต่ยังไม่อ้างว่าลดกัดเซาะหรือเกิด impact จากโครงการ',
  },
];

const dashboardTabs = [
  {
    id: 'portfolio',
    label: 'Dashboard เดิม',
    detail: 'Portfolio + survival',
    icon: Leaf,
  },
  {
    id: 'legacy',
    label: 'Legacy demo',
    detail: 'PM dashboard เก่า',
    icon: Building2,
  },
  {
    id: 'twin',
    label: 'แผนที่รายแปลง',
    detail: 'Spatial twin',
    icon: MapPinned,
  },
  {
    id: 'environmental',
    label: 'สภาพแวดล้อมและความเสี่ยง',
    detail: 'Environmental Intelligence',
    icon: CloudRain,
  },
  {
    id: 'year2',
    label: 'Year 2',
    detail: 'War room',
    icon: ShieldAlert,
  },
  {
    id: 'insight',
    label: 'Insight',
    detail: 'Executive page',
    icon: FileSpreadsheet,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    detail: 'Readiness QA',
    icon: Satellite,
  },
  {
    id: 'seg014Internal',
    label: 'SEG014 internal',
    detail: 'Pair viewer',
    icon: Target,
  },
  {
    id: 'nursery',
    label: 'Nursery',
    detail: 'Habitat index',
    icon: Sprout,
  },
  {
    id: 'coastalVulnerability',
    label: 'Coastal risk',
    detail: 'InVEST prep',
    icon: ShieldAlert,
  },
  {
    id: 'coastalExecutive',
    label: 'CV executive',
    detail: 'InVEST v6 report',
    icon: FileSpreadsheet,
  },
  {
    id: 'coastalPopulation',
    label: 'Population risk',
    detail: 'WorldPop v7',
    icon: AlertTriangle,
  },
  {
    id: 'habitatQuality',
    label: 'Habitat quality',
    detail: 'Screening v1',
    icon: CheckCircle2,
  },
  {
    id: 'claimReadiness',
    label: 'Claim matrix',
    detail: 'Readiness',
    icon: BookCheck,
  },
  {
    id: 'habitatRiskV2',
    label: 'HRA V3',
    detail: 'GHSL + ESA',
    icon: ShieldAlert,
  },
  {
    id: 'builtupRisk',
    label: 'Built-up risk',
    detail: 'GHSL + ESA',
    icon: AlertTriangle,
  },
  {
    id: 'blueCarbon',
    label: 'Blue carbon',
    detail: 'GEE screening',
    icon: Leaf,
  },
  {
    id: 'fieldPack',
    label: 'Field pack',
    detail: '65 targets',
    icon: MapPinned,
  },
  {
    id: 'executiveUpdate',
    label: 'Exec update',
    detail: 'A+B summary',
    icon: BookCheck,
  },
  {
    id: 'nonCarbon',
    label: 'Non-carbon',
    detail: 'Impact evidence',
    icon: Trees,
  },
  {
    id: 'glossary',
    label: 'Glossary',
    detail: 'คำศัพท์',
    icon: BookCheck,
  },
];

function DashboardTabs({ activeView, onSelect }) {
  return (
    <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
      {dashboardTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            className={`dashboard-tab ${isActive ? 'active' : ''}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
          >
            <Icon size={17} />
            <span>
              <strong>{tab.label}</strong>
              <small>{tab.detail}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReportFramePage({ page, activeView, onTabSelect }) {
  return (
    <main className="report-page">
      <header className="report-shell">
        <div className="report-shell-top">
          <div className="brand">
            <div className="brand-mark"><Leaf size={22} /></div>
            <div>
              <strong>Mangrove Carbon Portfolio</strong>
              <span>Combined dashboard workspace</span>
            </div>
          </div>
          <div className="source-pill">
            <FileSpreadsheet size={15} />
            รวมเว็บเก่า + หน้าใหม่ล่าสุด
          </div>
        </div>
        <DashboardTabs activeView={activeView} onSelect={onTabSelect} />
        <div className="report-heading">
          <div>
            <p className="eyebrow">{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </div>
        </div>
      </header>
      <iframe
        className="insight-frame"
        title={page.title}
        src={page.src}
      />
    </main>
  );
}

function TabbedWorkspace({ activeView, onTabSelect, children }) {
  return (
    <>
      <div className="workspace-tab-strip">
        <DashboardTabs activeView={activeView} onSelect={onTabSelect} />
      </div>
      {children}
    </>
  );
}

function ProjectCard({ project, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`project-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(project.id)}
      aria-pressed={selected}
    >
      <div className="project-top">
        <div>
          <p className="project-code">{project.shortName}</p>
          <h3>{project.name}</h3>
        </div>
        <span className={`standard ${project.standardType}`}>{project.standard}</span>
      </div>
      <p className="project-role">{project.story}</p>
      <div className="project-numbers">
        <div>
          <strong>{formatNumber(project.area, 2)}</strong>
          <span>ไร่</span>
        </div>
        <div>
          <strong>{formatNumber(project.annualCredits)}</strong>
          <span>tCO2e/ปี</span>
        </div>
        <div>
          <strong>{project.years}</strong>
          <span>ปี</span>
        </div>
      </div>
    </button>
  );
}

function ChangeChart() {
  return (
    <div className="comparison-chart">
      <div className="chart-legend">
        <span className="before-dot" /> ก่อนอัปเดต
        <span className="after-dot" /> หลังอัปเดต
      </div>
      {changeSummary.comparison.map((item) => (
        <div className="comparison-row" key={item.statusThai}>
          <p>{item.statusThai}</p>
          <div>
            <span className="bar before" style={{ width: `${item['ก่อนอัปเดต']}%` }}>
              <b>{item['ก่อนอัปเดต']}</b>
            </span>
            <span className="bar after" style={{ width: `${item['หลังอัปเดต']}%` }}>
              <b>{item['หลังอัปเดต']}</b>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupStatusChart() {
  return (
    <div className="group-chart">
      <div className="status-chart-legend">
        {Object.entries(STATUS_THAI).map(([status, label]) => (
          <span key={status}><i style={{ background: STATUS_COLORS[status] }} />{label}</span>
        ))}
      </div>
      {projects.map((project) => (
        <div className="group-row" key={project.id}>
          <div className="group-name">
            <strong>{project.shortName}</strong>
            <span>{project.plots} แปลง</span>
          </div>
          <div className="stacked-bar">
            {Object.entries(project.status).map(([status, count]) => (
              count > 0 && (
                <span
                  key={status}
                  style={{
                    background: STATUS_COLORS[status],
                    width: `${(count / project.plots) * 100}%`,
                  }}
                  title={`${STATUS_THAI[status]} ${count} แปลง`}
                >
                  {count}
                </span>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id);
  const [activeView, setActiveView] = useState(
    window.location.pathname === '/environmental-intelligence' ? 'environmental' : 'portfolio',
  );
  const [mapProjectId, setMapProjectId] = useState(projects[0].id);
  const [mapStatusFilter, setMapStatusFilter] = useState(ALL_STATUS);
  const [mapSelectedPlotId, setMapSelectedPlotId] = useState('');
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  useEffect(() => {
    function handlePopState() {
      setActiveView(
        window.location.pathname === '/environmental-intelligence' ? 'environmental' : 'portfolio',
      );
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function openDigitalTwin(projectId = selectedProjectId, status = ALL_STATUS, plotId = '') {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setMapProjectId(projectId);
    setMapStatusFilter(status);
    setMapSelectedPlotId(plotId);
    setActiveView('twin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDashboardTab(viewId) {
    if (viewId === 'twin') {
      openDigitalTwin(selectedProjectId);
      return;
    }
    const nextPath = viewId === 'environmental' ? '/environmental-intelligence' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openTwinFromPlot(plotId) {
    const match = failPlots.find((plot) => plot.id === plotId);
    const inferredProjectId = match?.projectId || (
      plotId.endsWith('-VSD') ? 'g2-wisutti' : 'g2-siam-tc'
    );
    openDigitalTwin(inferredProjectId, ALL_STATUS, plotId);
  }

  if (activeView === 'twin') {
    return (
      <TabbedWorkspace activeView={activeView} onTabSelect={openDashboardTab}>
        <SpatialTwin
          activeProjectId={mapProjectId}
          onProjectChange={(projectId) => {
            setMapProjectId(projectId);
            setMapSelectedPlotId('');
          }}
          selectedPlotId={mapSelectedPlotId}
          onSelectedPlotChange={setMapSelectedPlotId}
          statusFilter={mapStatusFilter}
          onStatusFilterChange={setMapStatusFilter}
          onBack={() => setActiveView('portfolio')}
        />
      </TabbedWorkspace>
    );
  }

  if (activeView === 'year2') {
    return (
      <TabbedWorkspace activeView={activeView} onTabSelect={openDashboardTab}>
        <Year2WarRoom
          onBack={() => setActiveView('portfolio')}
          onOpenTwin={openTwinFromPlot}
        />
      </TabbedWorkspace>
    );
  }

  if (activeView === 'environmental') {
    return (
      <TabbedWorkspace activeView={activeView} onTabSelect={openDashboardTab}>
        <EnvironmentalIntelligence />
      </TabbedWorkspace>
    );
  }

  if (activeView === 'insight') {
    return <ReportFramePage page={reportPages.insight} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'satellite') {
    return <ReportFramePage page={reportPages.satellite} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'seg014Internal') {
    return <ReportFramePage page={reportPages.seg014Internal} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'nursery') {
    return <ReportFramePage page={reportPages.nursery} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'coastalVulnerability') {
    return <ReportFramePage page={reportPages.coastalVulnerability} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'coastalExecutive') {
    return <ReportFramePage page={reportPages.coastalExecutive} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'coastalPopulation') {
    return <ReportFramePage page={reportPages.coastalPopulation} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'habitatQuality') {
    return <ReportFramePage page={reportPages.habitatQuality} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'claimReadiness') {
    return <ReportFramePage page={reportPages.claimReadiness} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'habitatRiskV2') {
    return <ReportFramePage page={reportPages.habitatRiskV2} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'builtupRisk') {
    return <ReportFramePage page={reportPages.builtupRisk} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'blueCarbon') {
    return <ReportFramePage page={reportPages.blueCarbon} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'fieldPack') {
    return <ReportFramePage page={reportPages.fieldPack} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'executiveUpdate') {
    return <ReportFramePage page={reportPages.executiveUpdate} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'nonCarbon') {
    return <ReportFramePage page={reportPages.nonCarbon} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'glossary') {
    return <ReportFramePage page={reportPages.glossary} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  if (activeView === 'legacy') {
    return <ReportFramePage page={reportPages.legacy} activeView={activeView} onTabSelect={openDashboardTab} />;
  }

  return (
    <main className="dashboard">
      <header className="hero">
        <nav className="topline">
          <div className="brand">
            <div className="brand-mark"><Leaf size={22} /></div>
            <div>
              <strong>Mangrove Carbon Portfolio</strong>
              <span>Company data review dashboard</span>
            </div>
          </div>
          <div className="source-pill">
            <FileSpreadsheet size={15} />
            ปรับปรุงข้อมูลสำรวจ: มีนาคม 2569 / up_270369
          </div>
        </nav>
        <DashboardTabs activeView={activeView} onSelect={openDashboardTab} />

        <div className="hero-grid">
          <section className="hero-copy">
            <p className="eyebrow">พอร์ตการฟื้นฟูป่าชายเลนของบริษัท</p>
            <h1>
              4 โครงการ T-VER
              <span>จากพื้นที่ปลูก สู่ผลลัพธ์คาร์บอนที่ตรวจติดตามได้</span>
            </h1>
            <p className="lede">
              ภาพรวมโครงการที่พัฒนาร่วมกับกรมทรัพยากรทางทะเลและชายฝั่ง
              ครอบคลุมมาตรฐาน Premium และ Standard T-VER พร้อมผลตรวจอัตรารอดตาย
              ของต้นไม้ทุกแปลงจาก workbook ล่าสุด
            </p>
            <div className="hero-note">
              <BookCheck size={18} />
              <p>
                ปริมาณคาร์บอนด้านล่างเป็น <strong>ค่าคาดการณ์ตามเอกสารโครงการ (PDD)</strong>
                ไม่ใช่จำนวนเครดิตที่ออกหรือรับรองแล้ว
              </p>
            </div>
          </section>

          <aside className="impact-panel">
            <div className="impact-header">
              <span>Portfolio estimate</span>
              <Trees size={20} />
            </div>
            <strong>{formatNumber(portfolio.annualCredits)}</strong>
            <p>tCO2e / ปี ที่คาดว่าจะลดได้จาก 4 โครงการ</p>
            <div className="impact-divider" />
            <div className="impact-meta">
              <div>
                <b>{formatNumber(portfolio.lifetimeCredits)}</b>
                <span>tCO2e ตามช่วงเครดิตใน PDD</span>
              </div>
              <div>
                <b>2</b>
                <span>มาตรฐาน: Premium + Standard</span>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <section className="metrics" aria-label="ตัวชี้วัดภาพรวม">
        <MetricCard
          icon={Building2}
          label="โครงการขึ้นทะเบียน"
          value={portfolio.projects}
          unit="โครงการ"
          detail="Premium 2 / Standard 2"
        />
        <MetricCard
          icon={Trees}
          label="พื้นที่โครงการรวม"
          value={formatNumber(portfolio.totalArea, 2)}
          unit="ไร่"
          detail="รวมพื้นที่ใน 4 PDD"
          accent="sea"
        />
        <MetricCard
          icon={Sprout}
          label="พื้นที่ปลูกจริง"
          value={formatNumber(portfolio.plantedArea, 2)}
          unit="ไร่"
          detail="จาก workbook อัตรารอดตาย"
          accent="lime"
        />
        <MetricCard
          icon={Target}
          label="แปลงที่สำรวจ"
          value={portfolio.plots}
          unit="แปลง"
          detail="อัปเดตผลรอดตายครบ 131 แปลง"
          accent="gold"
        />
      </section>

      <section className="section year2-highlight-section">
        <div className="year2-highlight-copy">
          <p className="eyebrow danger">Year 2 operations</p>
          <h2>
            แผนงานปีที่ 2
            <span className="delay-highlight">ล่าช้าจากแผน {formatNumber(year2Highlights.progressGap, 2)}%</span>
          </h2>
          <p>
            ความคืบหน้าจริงใน activity plan อยู่ที่ {formatNumber(year2Highlights.actualProgress, 2)}%
            จากแผน {formatNumber(year2Highlights.planProgress, 2)}% โดยงานคงเหลือกระจุกตัวที่ {year2Highlights.topProvinces}
          </p>
          <button className="year2-highlight-button" type="button" onClick={() => setActiveView('year2')}>
            <ShieldAlert size={17} />
            เปิดแผนงานปีที่ 2
          </button>
        </div>
        <div className="year2-highlight-grid">
          <article>
            <span>Weighted progress</span>
            <strong>{formatNumber(year2Highlights.weightedProgress, 2)}%</strong>
            <p>{formatNumber(year2Highlights.activePlots)} active / {formatNumber(year2Highlights.holdPlots)} hold records</p>
          </article>
          <article className="danger">
            <span>Delayed plots</span>
            <strong>{formatNumber(year2Highlights.delayedPlots)} แปลง</strong>
            <p>สถานะ D ที่ต้องเร่งปิดงาน</p>
          </article>
          <article className="warn">
            <span>Remaining area</span>
            <strong>{formatNumber(year2Highlights.remainingArea, 1)} ไร่</strong>
            <p>ไร่-progress ที่ยังต้องปิด</p>
          </article>
          <article>
            <span>Top risk plot</span>
            <strong>{year2Highlights.topRiskPlot}</strong>
            <p>เหลือ {formatNumber(year2Highlights.topRiskRemaining, 1)} ไร่-progress</p>
          </article>
        </div>
      </section>

      <section className="section report-entry-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest evidence pages</p>
            <h2>หน้าใหม่ที่รวมจากเว็บล่าสุด</h2>
          </div>
          <p className="section-copy">
            เปิดเป็นหน้าแยกใน dashboard เดิม เพื่อรักษาหน้า portfolio และ workflow เดิมไว้ครบ
          </p>
        </div>
        <div className="report-entry-grid">
          <button className="report-entry-card satellite-entry" type="button" onClick={() => setActiveView('satellite')}>
            <Satellite size={22} />
            <span>ภาพถ่ายดาวเทียม</span>
            <strong>Readiness update · 2 มิ.ย. 2569</strong>
            <p>รวม tide QA, SEG012 human QA, SEG025/SEG027 baseline replacement และ GEE 2023/2024 intake ล่าสุด</p>
          </button>
          <button className="report-entry-card seg014-entry" type="button" onClick={() => setActiveView('seg014Internal')}>
            <Target size={22} />
            <span>SEG014 internal</span>
            <strong>Pair viewer ภายในสำหรับ SEG014</strong>
            <p>เปิด dashboard คัดกรองภาพดาวเทียมเฉพาะ SEG014 พร้อมคู่เวลา ดัชนี NDVI/NDWI/MNDWI และ caveat การใช้งาน</p>
          </button>
          <button className="report-entry-card impact-entry" type="button" onClick={() => setActiveView('nonCarbon')}>
            <Leaf size={22} />
            <span>Non-carbon impact</span>
            <strong>สรุปหลักฐานเชิงพื้นที่ล่าสุด</strong>
            <p>รายงานผลกระทบที่ไม่ใช่คาร์บอนพร้อมแผนที่ทางน้ำ ชุมชน ชายฝั่ง DSAS ดาวเทียม และข้อจำกัดการกล่าวอ้าง</p>
          </button>
          <button className="report-entry-card coastal-exec-entry" type="button" onClick={() => setActiveView('coastalExecutive')}>
            <ShieldAlert size={22} />
            <span>Coastal vulnerability</span>
            <strong>รายงานฉบับผู้บริหารจาก InVEST v6</strong>
            <p>สรุป hotspot, driver ranks, ERA5 wave, DMR geomorphology และข้อจำกัดการ claim impact ให้ผู้บริหารอ่านง่าย</p>
          </button>
        </div>
        <button className="report-entry-wide nursery-entry" type="button" onClick={() => setActiveView('nursery')}>
          <Sprout size={21} />
          <span>Nursery habitat potential</span>
          <strong>ดัชนีคัดกรองแหล่งอนุบาลสัตว์น้ำจากข้อมูลที่มีแล้ว</strong>
          <p>รวมแปลงปลูก ทางน้ำ/พื้นที่น้ำ แนวชายฝั่ง NDWI/MNDWI readiness และ tide readiness เป็น shortlist สำหรับ field validation โดยไม่อ้างผลผลิตประมงจริง</p>
        </button>
        <div className="evidence-update-grid" aria-label="June 2 evidence update">
          {evidenceUpdates.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section portfolio-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>4 โครงการที่ขับเคลื่อนพอร์ตคาร์บอนป่าชายเลน</h2>
          </div>
          <p className="section-copy">
            พื้นที่และปริมาณคาร์บอนคาดการณ์ตรวจเทียบจาก PDD ในโฟลเดอร์ Company-data
          </p>
        </div>
        <div className="project-layout">
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selected={project.id === selectedProjectId}
                onSelect={setSelectedProjectId}
              />
            ))}
          </div>
          <article className="project-focus">
            <div className="focus-title">
              <span>Selected project</span>
              <h3>{selectedProject.name}</h3>
              <p>{selectedProject.officialName}</p>
            </div>
            <dl>
              <div>
                <dt>มาตรฐาน</dt>
                <dd>{selectedProject.standard}</dd>
              </div>
              <div>
                <dt>จำนวนแปลงสำรวจ</dt>
                <dd>{selectedProject.plots} แปลง</dd>
              </div>
              <div>
                <dt>อัตรารอดตายเฉลี่ย</dt>
                <dd>{formatNumber(selectedProject.averageSurvival, 2)}%</dd>
              </div>
              <div>
                <dt>ระยะเครดิต</dt>
                <dd>{selectedProject.creditPeriod}</dd>
              </div>
            </dl>
            <div className="focus-status">
              {Object.entries(selectedProject.status).map(([status, count]) => (
                count > 0 && (
                  <div key={status}>
                    <StatusBadge status={status} />
                    <strong>{count}</strong>
                    <span>แปลง</span>
                  </div>
                )
              ))}
            </div>
            <button
              className="focus-map-button"
              type="button"
              onClick={() => openDigitalTwin(selectedProject.id)}
            >
              <MapPinned size={17} />
              เปิดแผนที่รายแปลงของโครงการนี้
            </button>
            {selectedProject.spatialNote && <p className="spatial-note">{selectedProject.spatialNote}</p>}
          </article>
        </div>
      </section>

      <section className="section survival-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest field update</p>
            <h2>อัตรารอดตายหลังอัปเดตรอบหนังสือชี้ชวน</h2>
          </div>
          <p className="section-copy">
            เกณฑ์ Passed ตั้งแต่ 80% ขึ้นไป, Incomplete 25% - 79.99%, Fail ต่ำกว่า 25%
          </p>
        </div>

        <div className="status-grid">
          <article className="status-overview">
            <div className="status-area-bar" aria-label="สัดส่วนพื้นที่ตามสถานะ">
              {statusSummary.map((item) => (
                <div
                  key={item.status}
                  style={{
                    width: `${item.share}%`,
                    backgroundColor: STATUS_COLORS[item.status],
                  }}
                  title={`${STATUS_THAI[item.status]} ${item.share}%`}
                />
              ))}
            </div>
            <div className="status-list">
              {statusSummary.map((item) => (
                <div className="status-row" key={item.status}>
                  <StatusBadge status={item.status} />
                  <strong>{item.plots} แปลง</strong>
                  <span>{formatNumber(item.area, 2)} ไร่</span>
                  <em>{formatNumber(item.share, 2)}%</em>
                </div>
              ))}
            </div>
            <div className="band-breakdown">
              <p>รายละเอียดพื้นที่ Incomplete ตามระดับตรวจรับ</p>
              {incompleteBands.map((band) => (
                <div key={band.label}>
                  <span>{band.label}</span>
                  <strong>{formatNumber(band.area, 2)} ไร่</strong>
                  <em>{formatNumber(band.share, 2)}%</em>
                </div>
              ))}
            </div>
          </article>

          <article className="change-card">
            <div className="change-top">
              <AlertTriangle size={21} />
              <div>
                <p>จุดเปลี่ยนสำคัญหลังสำรวจรอบใหม่</p>
                <strong>{changeSummary.passedToIncomplete} แปลง</strong>
              </div>
            </div>
            <h3>ตกจาก Passed เป็น Incomplete</h3>
            <p>
              ผลอัปเดตทำให้แปลงที่ผ่านเกณฑ์ลดจาก {changeSummary.beforePassed} เป็น{' '}
              {changeSummary.afterPassed} แปลง และมีแปลงเปลี่ยนสถานะรวม{' '}
              {changeSummary.changedPlots} แปลง
            </p>
            <div className="delta">
              <ArrowDownRight size={18} />
              Passed ลดลง {changeSummary.beforePassed - changeSummary.afterPassed} แปลง
            </div>
          </article>
        </div>

        <div className="chart-grid">
          <article className="chart-panel">
            <div className="panel-title">
              <h3>จำนวนแปลง ก่อน vs หลังอัปเดต</h3>
              <p>มองเห็นการเปลี่ยนสถานะในระดับ portfolio</p>
            </div>
            <ChangeChart />
          </article>

          <article className="chart-panel">
            <div className="panel-title">
              <h3>สถานะหลังอัปเดตแยกตามกลุ่มโครงการ</h3>
              <p>จำนวนแปลงในแต่ละสถานะจาก workbook ล่าสุด</p>
            </div>
            <GroupStatusChart />
          </article>
        </div>
      </section>

      <section className="section action-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow danger">Immediate attention</p>
            <h2>แปลงไม่ผ่านเกณฑ์ขั้นต่ำ 8 แปลง</h2>
          </div>
          <p className="section-copy">
            แปลงที่มีอัตรารอดตายต่ำกว่า 25% ควรจัดลำดับสำรวจสาเหตุและวางแผนปลูกซ่อม
          </p>
        </div>
        <div className="action-layout">
          <div className="fail-table">
            <div className="fail-head">
              <span>แปลง / จังหวัด</span>
              <span>กลุ่มโครงการ</span>
              <span>อัตรารอดตาย</span>
            </div>
            {failPlots.map((plot) => (
              <button
                className="fail-row"
                key={plot.id}
                type="button"
                onClick={() => openDigitalTwin(plot.projectId, 'Fail', plot.id)}
              >
                <div>
                  <strong>{plot.id}</strong>
                  <span>{plot.province}</span>
                </div>
                <p>{plot.group}</p>
                <b>{formatNumber(plot.survival, 2)}%</b>
              </button>
            ))}
          </div>

          <aside className="adjusted-panel">
            <p className="eyebrow">Adjusted summary table</p>
            <h3>พื้นที่ที่ยังไม่ผ่านเกณฑ์ Passed</h3>
            <strong>{formatNumber(adjustedSummary.belowPassedArea, 2)} <small>ไร่</small></strong>
            <p className="formula">
              จากสูตร workbook: พื้นที่รวม - พื้นที่ Passed
            </p>
            <div className="adjusted-metrics">
              <div>
                <span>ประมาณการรายปีของพื้นที่ดังกล่าว</span>
                <b>{formatNumber(adjustedSummary.annualEstimate, 2)}</b>
                <small>tCO2e/ปี</small>
              </div>
              <div>
                <span>กรอบประมาณการ 7 ปีของพื้นที่รวม</span>
                <b>{formatNumber(adjustedSummary.sevenYearEstimate, 2)}</b>
                <small>tCO2e</small>
              </div>
            </div>
            <p className="disclaimer">
              คำนวณตามสัมประสิทธิ์ 9.4 tCO2e/ไร่/ปีใน workbook
              เพื่อประกอบหนังสือชี้ชวน ไม่ใช่ปริมาณเครดิตที่รับรองแล้ว
            </p>
          </aside>
        </div>
      </section>

      <footer className="footer">
        <div>
          <CheckCircle2 size={18} />
          <p>
            แหล่งข้อมูล: PDD และเอกสารโครงการใน <strong>Company-data</strong> +
            workbook <strong>อัตราการรอดตายของแต่ละแปลง (131-TOKEN).xlsx</strong>
          </p>
        </div>
        <span>ข้อมูลผลสำรวจล่าสุด: มีนาคม 2569</span>
      </footer>
    </main>
  );
}

export default App;
