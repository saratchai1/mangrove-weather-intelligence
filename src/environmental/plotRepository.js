import { projects } from '../portfolioData.js';
import { getRepresentativePoint } from '../utils/geometry.js';
import { withBasePath } from '../utils/basePath.js';

const spatialProjects = () => projects.filter((project) => project.spatialAvailable);

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`โหลดข้อมูลแปลงไม่สำเร็จ: ${url}`);
  return response.json();
}

async function fetchOptionalJson(url, fetchImpl, fallback) {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

export async function getVisiblePlots({
  fetchImpl = fetch,
  canViewPlot = () => true,
} = {}) {
  const riskData = await fetchOptionalJson(
    withBasePath('/data/plot-risk-factors.json'),
    fetchImpl,
    { records: [] },
  );
  const riskByPlotKey = new Map(
    (riskData.records || [])
      .filter((record) => record.matchStatus === 'MATCHED' && record.plotKey)
      .map((record) => [record.plotKey, record]),
  );
  const projectRecords = await Promise.all(spatialProjects().map(async (appProject) => {
    const root = withBasePath(`/data/${appProject.id}`);
    const [projectMetadata, geojson] = await Promise.all([
      fetchJson(`${root}/project.json`, fetchImpl),
      fetchJson(`${root}/planting-areas.geojson`, fetchImpl),
    ]);

    return (geojson.features || []).map((feature) => {
      const properties = feature.properties || {};
      const plotId = String(properties.plotId || properties.layerId || '').trim();
      const plotKey = `${appProject.id}:${plotId}`;
      const plot = {
        plotId,
        plotKey,
        plotName: properties.plotName || plotId,
        projectId: appProject.id,
        projectName: projectMetadata.officialName || appProject.officialName || appProject.name,
        province: properties.province || '',
        district: properties.district || '',
        subdistrict: properties.subdistrict || '',
        geometry: feature.geometry || null,
        representativePoint: getRepresentativePoint(feature),
        riskFactor: riskByPlotKey.get(plotKey) || null,
        sourceProperties: properties,
      };
      return plot;
    }).filter((plot) => plot.plotId && canViewPlot(plot));
  }));

  return projectRecords.flat();
}
