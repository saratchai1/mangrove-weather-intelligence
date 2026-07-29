import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Filter,
  Search,
  ShieldAlert,
  Target,
  Trees,
} from 'lucide-react';

const STATUS_LABELS = {
  C: 'Completed',
  D: 'Delayed',
  I: 'In progress',
  O: 'On going',
  N: 'Not started',
  blank: 'Hold / Missing',
  '': 'Hold / Missing',
};

const STATUS_COLORS = {
  C: '#16a34a',
  D: '#ef4444',
  I: '#2563eb',
  O: '#7c3aed',
  N: '#64748b',
  blank: '#94a3b8',
  '': '#94a3b8',
};

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${formatNumber(value, decimals)}%`;
}

function normalizeProvince(value) {
  if (!value) return 'ไม่ระบุ';
  return String(value)
    .replace(/^จ\./, '')
    .replace('จันทุบุรี', 'จันทบุรี')
    .trim();
}

function remainingArea(record) {
  if (record.progressPercent === null || record.progressPercent === undefined) return null;
  return Number(record.areaRai || 0) * Math.max(0, 1 - Number(record.progressPercent) / 100);
}

function doneArea(record) {
  if (record.progressPercent === null || record.progressPercent === undefined) return 0;
  return Number(record.areaRai || 0) * Number(record.progressPercent) / 100;
}

function groupBy(records, keyFn) {
  const map = new Map();
  records.forEach((record) => {
    const key = keyFn(record) || 'ไม่ระบุ';
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        plots: 0,
        area: 0,
        done: 0,
        remaining: 0,
        statuses: {},
      });
    }
    const item = map.get(key);
    const status = record.statusCode || 'blank';
    item.plots += 1;
    item.area += Number(record.areaRai || 0);
    item.done += doneArea(record);
    item.remaining += remainingArea(record) || 0;
    item.statuses[status] = (item.statuses[status] || 0) + 1;
  });
  return [...map.values()].map((item) => ({
    ...item,
    progress: item.area ? item.done / item.area * 100 : null,
  }));
}

function activityBucket(description = '') {
  if (/ปลูกซ่อม|กล้าไม้|ศัตรูพืช|เพรียง|กระติ๊บ/.test(description)) return 'ปลูกซ่อม/กำจัดศัตรูพืช';
  if (/แผ้วถาง|ลิดกิ่ง|วัชพืช/.test(description)) return 'แผ้วถาง/ลิดกิ่ง';
  if (/อัตราการรอดตาย|แปลงตัวอย่าง|survival/i.test(description)) return 'นับ/ตรวจอัตรารอดตาย';
  if (/พิกัด|หมุด|แนวเขต/.test(description)) return 'ตรวจพิกัด/หมุดแปลง';
  if (/ปอ\.4|รายงาน/.test(description)) return 'รายงาน ปอ.4';
  if (/ส่งมอบ/.test(description)) return 'ส่งมอบงาน';
  return 'กิจกรรมอื่น';
}

function summarizeActivities(activities = []) {
  const map = new Map();
  activities
    .filter((activity) => activity.level > 1)
    .forEach((activity) => {
      const key = activityBucket(activity.description);
      if (!map.has(key)) {
        map.set(key, { name: key, tasks: 0, plan: 0, progress: 0, gap: 0, statuses: {} });
      }
      const item = map.get(key);
      const weight = Number(activity.weightPercent || 0) / 100;
      const plan = Number(activity.planPercent || 0) / 100;
      const progress = Number(activity.progressPercent || 0) / 100;
      const status = activity.statusCode || 'blank';
      item.tasks += 1;
      item.plan += weight * plan * 100;
      item.progress += weight * progress * 100;
      item.statuses[status] = (item.statuses[status] || 0) + 1;
    });
  return [...map.values()]
    .map((item) => ({ ...item, gap: item.plan - item.progress }))
    .sort((a, b) => b.gap - a.gap);
}

function summarizePeriods(activities = []) {
  const map = new Map();
  activities.forEach((activity) => {
    const wbs = String(activity.wbsNo || '');
    const match = wbs.match(/^([1-4])(\.|$)/);
    if (!match) return;
    const key = `งวดที่ ${match[1]}`;
    if (!map.has(key)) map.set(key, { name: key, tasks: 0, plan: 0, progress: 0, gap: 0 });
    const item = map.get(key);
    const weight = Number(activity.weightPercent || 0) / 100;
    item.tasks += 1;
    item.plan += weight * Number(activity.planPercent || 0) / 100 * 100;
    item.progress += weight * Number(activity.progressPercent || 0) / 100 * 100;
  });
  return [...map.values()].map((item) => ({ ...item, gap: item.plan - item.progress }));
}

function KpiCard({ label, value, note, tone = 'default', icon: Icon }) {
  return (
    <article className={`yr-kpi ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
      {Icon && <Icon size={22} />}
    </article>
  );
}

function BarList({ rows, valueKey = 'remaining', formatter, tone = 'default', maxRows = 8 }) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(...visible.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="yr-bar-list">
      {visible.map((row) => (
        <div className="yr-bar-row" key={row.name}>
          <span>{row.name}</span>
          <div className="yr-bar-track">
            <i
              className={tone}
              style={{ width: `${Math.max(2, Number(row[valueKey] || 0) / max * 100)}%` }}
            />
          </div>
          <b>{formatter ? formatter(row[valueKey], row) : formatNumber(row[valueKey], 1)}</b>
        </div>
      ))}
    </div>
  );
}

function StatusDonut({ rows }) {
  const statusRows = groupBy(rows, (record) => record.statusCode || 'blank').sort((a, b) => b.area - a.area);
  const totalArea = statusRows.reduce((sum, row) => sum + row.area, 0);
  const gradient = statusRows.reduce((acc, row) => {
    const start = acc.cursor;
    const end = start + (totalArea ? row.area / totalArea * 100 : 0);
    return {
      cursor: end,
      segments: [
        ...acc.segments,
        `${STATUS_COLORS[row.name] || STATUS_COLORS.blank} ${start}% ${end}%`,
      ],
    };
  }, { cursor: 0, segments: [] }).segments.join(', ');
  return (
    <div className="yr-status-layout">
      <div className="yr-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{formatPercent(totalArea ? rows.reduce((sum, row) => sum + doneArea(row), 0) / totalArea * 100 : 0)}</strong>
          <span>weighted</span>
        </div>
      </div>
      <div>
        {statusRows.map((row) => (
          <div className="yr-status-row" key={row.name}>
            <i style={{ background: STATUS_COLORS[row.name] || STATUS_COLORS.blank }} />
            <span>{STATUS_LABELS[row.name] || row.name}</span>
            <b>{row.plots} แปลง</b>
            <em>{formatNumber(row.area, 1)} ไร่</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(rows) {
  const headers = ['plotId', 'province', 'client', 'status', 'areaRai', 'progressPercent', 'remainingAreaRai', 'projectName'];
  const body = rows.map((row) => [
    row.plotId,
    normalizeProvince(row.province),
    row.client || '',
    row.statusCode || '',
    row.areaRai ?? '',
    row.progressPercent ?? '',
    remainingArea(row) ?? '',
    row.projectName || '',
  ]);
  const csv = [headers, ...body]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'year2-filtered-plots.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function Year2WarRoom({ onBack, onOpenTwin }) {
  const [workplan, setWorkplan] = useState(null);
  const [province, setProvince] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    fetch('/data/year2-workplan.json')
      .then((response) => {
        if (!response.ok) throw new Error('โหลด Year 2 workplan ไม่สำเร็จ');
        return response.json();
      })
      .then((data) => {
        if (live) setWorkplan(data);
      })
      .catch((reason) => {
        if (live) setError(reason.message);
      });
    return () => {
      live = false;
    };
  }, []);

  const activeRows = useMemo(() => (
    workplan?.records?.filter((record) => record.statusCode) || []
  ), [workplan]);
  const holdRows = useMemo(() => (
    workplan?.records?.filter((record) => !record.statusCode) || []
  ), [workplan]);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return activeRows.filter((record) => {
      if (province && normalizeProvince(record.province) !== province) return false;
      if (client && record.client !== client) return false;
      if (status && record.statusCode !== status) return false;
      if (!text) return true;
      return `${record.plotId} ${record.province} ${record.client} ${record.projectName} ${record.statusCode}`.toLowerCase().includes(text);
    });
  }, [activeRows, province, client, status, query]);

  const summary = useMemo(() => {
    const area = filteredRows.reduce((sum, row) => sum + Number(row.areaRai || 0), 0);
    const done = filteredRows.reduce((sum, row) => sum + doneArea(row), 0);
    const remaining = filteredRows.reduce((sum, row) => sum + (remainingArea(row) || 0), 0);
    const delayed = filteredRows.filter((row) => row.statusCode === 'D');
    return {
      area,
      done,
      remaining,
      weighted: area ? done / area * 100 : null,
      delayedPlots: delayed.length,
      delayedArea: delayed.reduce((sum, row) => sum + Number(row.areaRai || 0), 0),
    };
  }, [filteredRows]);

  const provinces = useMemo(() => (
    [...new Set(activeRows.map((row) => normalizeProvince(row.province)))].sort((a, b) => a.localeCompare(b, 'th'))
  ), [activeRows]);
  const clients = useMemo(() => (
    [...new Set(activeRows.map((row) => row.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))
  ), [activeRows]);

  const provinceSummary = useMemo(() => (
    groupBy(filteredRows, (row) => normalizeProvince(row.province)).sort((a, b) => b.remaining - a.remaining)
  ), [filteredRows]);
  const clientSummary = useMemo(() => (
    groupBy(filteredRows, (row) => row.client).sort((a, b) => b.remaining - a.remaining)
  ), [filteredRows]);
  const topRisk = useMemo(() => (
    [...filteredRows]
      .map((row) => ({ ...row, remaining: remainingArea(row) || 0 }))
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 15)
  ), [filteredRows]);
  const activitySummary = useMemo(() => summarizeActivities(workplan?.activities || []), [workplan]);
  const periodSummary = useMemo(() => summarizePeriods(workplan?.activities || []), [workplan]);
  const planProgress = workplan?.summary?.activityPlanPercent ?? 79.41;
  const actualProgress = 56.33;
  const progressGap = planProgress - actualProgress;

  if (error) {
    return (
      <main className="dashboard yr-shell">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> กลับหน้ารวม</button>
        <section className="twin-unavailable"><AlertTriangle size={28} /><h1>{error}</h1></section>
      </main>
    );
  }

  if (!workplan) {
    return <main className="dashboard yr-shell"><section className="twin-loading">กำลังโหลด Year 2 Operations War Room...</section></main>;
  }

  return (
    <main className="dashboard yr-shell">
      <header className="yr-hero">
        <nav className="twin-nav">
          <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> กลับหน้ารวม</button>
          <button className="yr-export" type="button" onClick={() => exportCsv(filteredRows)}>
            <Download size={15} />
            Export CSV
          </button>
        </nav>
        <div className="yr-hero-grid">
          <section>
            <p className="eyebrow">Year 2 Operations War Room</p>
            <h1>แผนบำรุงรักษาป่าชายเลนปีที่ 2 ที่ต้องเร่งปิดความเสี่ยง</h1>
            <p>
              ถอดจาก workbook TEAMG เพื่อดู progress ถ่วงน้ำหนัก, งานคงเหลือตามจังหวัด,
              bottleneck ตามกิจกรรม และแปลงที่ควรสั่งการก่อน
            </p>
          </section>
          <aside>
            <span>Overall activity gap</span>
            <strong>-{formatNumber(progressGap, 2)} pp</strong>
            <p>Plan {formatPercent(planProgress)} / Progress {formatPercent(actualProgress)}</p>
          </aside>
        </div>
      </header>

      <section className="yr-kpi-grid">
        <KpiCard icon={Trees} label="Weighted progress" value={formatPercent(summary.weighted)} note={`${formatNumber(summary.done, 1)} จาก ${formatNumber(summary.area, 1)} ไร่-progress`} tone="primary" />
        <KpiCard icon={ShieldAlert} label="Delayed plots" value={`${formatNumber(summary.delayedPlots)} แปลง`} note={`${formatNumber(summary.delayedArea, 1)} ไร่ในสถานะ D`} tone="danger" />
        <KpiCard icon={Target} label="Remaining area" value={`${formatNumber(summary.remaining, 1)} ไร่`} note="พื้นที่ถ่วงน้ำหนักที่ยังต้องปิด" tone="warn" />
        <KpiCard icon={CheckCircle2} label="Active / Hold" value={`${activeRows.length} / ${holdRows.length}`} note={`records รวม ${workplan.records.length} แถว`} />
      </section>

      <section className="yr-panel yr-insights">
        <article>
          <h2>สิ่งที่ต้องสั่งการ</h2>
          <p>3 จังหวัดแรกที่กินงานคงเหลือสูงสุดคือ {provinceSummary.slice(0, 3).map((row) => row.name).join(', ')} รวมกันเป็นแกนหลักของ recovery plan</p>
        </article>
        <article>
          <h2>คอขวดจริง</h2>
          <p>{activitySummary[0]?.name} มี gap สูงสุด {formatNumber(activitySummary[0]?.gap, 2)} pp ตามด้วย {activitySummary[1]?.name}</p>
        </article>
        <article>
          <h2>Top risk</h2>
          <p>แปลง {topRisk[0]?.plotId} จ.{normalizeProvince(topRisk[0]?.province)} เหลืองาน {formatNumber(topRisk[0]?.remaining, 1)} ไร่-progress</p>
        </article>
      </section>

      <section className="yr-panel">
        <div className="yr-filter-title">
          <div>
            <p className="section-label">Live Filters</p>
            <h2>กรองแล้ว KPI และตารางจะเปลี่ยนทันที</h2>
          </div>
          <button type="button" className="secondary" onClick={() => { setProvince(''); setClient(''); setStatus(''); setQuery(''); }}>
            Reset
          </button>
        </div>
        <div className="yr-filters">
          <label><Filter size={13} /> จังหวัด
            <select value={province} onChange={(event) => setProvince(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {provinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>ลูกค้า
            <select value={client} onChange={(event) => setClient(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {clients.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>สถานะ
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {['C', 'D', 'I', 'O'].map((item) => <option key={item} value={item}>{item} - {STATUS_LABELS[item]}</option>)}
            </select>
          </label>
          <label><Search size={13} /> ค้นหาแปลง
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น 18-VSD / พังงา" />
          </label>
        </div>
      </section>

      <section className="yr-grid">
        <article className="yr-panel">
          <h2>งานคงเหลือสูงสุดตามจังหวัด</h2>
          <BarList rows={provinceSummary} formatter={(value) => `${formatNumber(value, 1)} ไร่`} tone="danger" />
        </article>
        <article className="yr-panel">
          <h2>สถานะตามพื้นที่</h2>
          <StatusDonut rows={filteredRows} />
        </article>
      </section>

      <section className="yr-grid">
        <article className="yr-panel">
          <h2>ลูกค้าที่ต้องเร่งรัด</h2>
          <BarList rows={clientSummary} formatter={(value) => `${formatNumber(value, 1)} ไร่`} tone="warn" />
        </article>
        <article className="yr-panel">
          <h2>Gap ตามงวดงาน</h2>
          <BarList rows={periodSummary.sort((a, b) => b.gap - a.gap)} valueKey="gap" formatter={(value) => `${formatNumber(value, 2)} pp`} tone="blue" maxRows={4} />
        </article>
      </section>

      <section className="yr-panel">
        <h2>Activity bottleneck</h2>
        <BarList rows={activitySummary} valueKey="gap" formatter={(value, row) => `${formatNumber(value, 2)} pp · ${row.tasks} tasks`} tone="danger" maxRows={7} />
      </section>

      <section className="yr-panel">
        <div className="yr-table-heading">
          <div>
            <p className="section-label">Top Risk Plot</p>
            <h2>แปลงที่เหลืองานสูงสุด</h2>
          </div>
          <span>{filteredRows.length} active records</span>
        </div>
        <div className="yr-table-wrap">
          <table className="yr-table">
            <thead>
              <tr>
                <th>แปลง</th>
                <th>จังหวัด</th>
                <th>ลูกค้า</th>
                <th>สถานะ</th>
                <th className="num">พื้นที่</th>
                <th className="num">Progress</th>
                <th className="num">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {topRisk.map((row) => (
                <tr key={row.plotId}>
                  <td>
                    <button className="yr-plot-link" type="button" onClick={() => onOpenTwin?.(row.plotId)}>
                      {row.plotId}
                    </button>
                  </td>
                  <td>{normalizeProvince(row.province)}</td>
                  <td>{row.client}</td>
                  <td><span className={`yr-pill ${row.statusCode}`}>{STATUS_LABELS[row.statusCode] || row.statusCode}</span></td>
                  <td className="num">{formatNumber(row.areaRai, 2)}</td>
                  <td className="num">{formatPercent(row.progressPercent)}</td>
                  <td className="num">{formatNumber(row.remaining, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="yr-panel">
        <div className="yr-table-heading">
          <div>
            <p className="section-label">Hold / Missing Status</p>
            <h2>แปลงที่ต้องเคลียร์ data status</h2>
          </div>
          <span>{holdRows.length} records</span>
        </div>
        <div className="yr-hold-grid">
          {holdRows.map((row) => (
            <article key={row.plotId}>
              <strong>{row.plotId}</strong>
              <span>{normalizeProvince(row.province)} · {formatNumber(row.areaRai, 2)} ไร่</span>
              <p>{row.projectName}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Year2WarRoom;
