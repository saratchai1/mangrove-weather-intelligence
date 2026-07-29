export const portfolio = {
  projects: 4,
  plots: 131,
  totalArea: 17531.04,
  plantedArea: 9453.93,
  annualCredits: 165395,
  lifetimeCredits: 1739229,
};

export const projects = [
  {
    id: 'g1-wisutti',
    shortName: 'G1 - Wisutti',
    name: 'Premium T-VER / Wisutti',
    officialName: 'โครงการปลูกป่าชายเลนช่วยโลกลดก๊าซเรือนกระจกในประเทศไทย (กลุ่ม 1)',
    standard: 'Premium T-VER',
    standardType: 'premium',
    story: 'สยาม ทีซี และวิสุทธิ คอนซัลแตนท์ ร่วมพัฒนา',
    area: 1195.64,
    annualCredits: 11315,
    totalCredits: 169725,
    years: 15,
    creditPeriod: '15 ปี (1 ต.ค. 2566 - 30 ก.ย. 2581)',
    plots: 40,
    spatialAvailable: true,
    averageSurvival: 68.88,
    status: { Passed: 19, Incomplete: 17, Fail: 4, 'On going': 0 },
  },
  {
    id: 'g1-siam-tc',
    shortName: 'G1 - Siam TC',
    name: 'Premium T-VER / Siam TC',
    officialName: 'โครงการฟื้นฟูป่าชายเลน เพื่อระบบนิเวศที่ยั่งยืนของประเทศไทย (กลุ่ม 1)',
    standard: 'Premium T-VER',
    standardType: 'premium',
    story: 'สยาม ทีซี เทคโนโลยี เป็นผู้ร่วมพัฒนาโครงการ',
    area: 554.32,
    annualCredits: 5739,
    totalCredits: 86085,
    years: 15,
    creditPeriod: '15 ปี (1 ต.ค. 2566 - 30 ก.ย. 2581)',
    plots: 19,
    spatialAvailable: true,
    averageSurvival: 70.29,
    status: { Passed: 9, Incomplete: 7, Fail: 2, 'On going': 1 },
  },
  {
    id: 'g2-wisutti',
    shortName: 'G2 - Wisutti',
    name: 'Standard T-VER / Wisutti',
    officialName: 'โครงการปลูกป่าชายเลนช่วยโลกลดก๊าซเรือนกระจกในประเทศไทย (กลุ่ม 2)',
    standard: 'Standard T-VER',
    standardType: 'standard',
    story: 'กลุ่มพื้นที่ขนาดใหญ่ที่มีอัตรารอดตายเฉลี่ยสูงสุด',
    area: 6775.53,
    annualCredits: 63689,
    totalCredits: 636899,
    years: 10,
    creditPeriod: '10 ปี (31 พ.ค. 2567 - 30 พ.ค. 2577)',
    plots: 22,
    spatialAvailable: true,
    averageSurvival: 81.15,
    status: { Passed: 16, Incomplete: 6, Fail: 0, 'On going': 0 },
  },
  {
    id: 'g2-siam-tc',
    shortName: 'G2 - Siam TC',
    name: 'Standard T-VER / Siam TC',
    officialName: 'โครงการฟื้นฟูป่าชายเลนเพื่อระบบนิเวศที่ยั่งยืนของประเทศไทย (กลุ่ม 2)',
    standard: 'Standard T-VER',
    standardType: 'standard',
    story: 'โครงการพื้นที่ใหญ่ที่สุดและมีประมาณการคาร์บอนสูงที่สุด',
    area: 9005.55,
    annualCredits: 84652,
    totalCredits: 846520,
    years: 10,
    creditPeriod: '10 ปี (15 พ.ย. 2566 - 14 พ.ย. 2576)',
    plots: 50,
    spatialAvailable: true,
    spatialNote: 'geometry จาก G2 Siam TC preview; crosswalk ส่วนใหญ่เป็น tentative จากจังหวัดและพื้นที่ใกล้ที่สุด',
    averageSurvival: 70.17,
    status: { Passed: 26, Incomplete: 22, Fail: 2, 'On going': 0 },
  },
];

export const statusSummary = [
  { status: 'Passed', plots: 70, area: 9691.25663, share: 55.280563 },
  { status: 'Incomplete', plots: 52, area: 7418.218777, share: 42.313768 },
  { status: 'Fail', plots: 8, area: 264.0128, share: 1.505974 },
  { status: 'On going', plots: 1, area: 157.55, share: 0.898692 },
];

export const incompleteBands = [
  { label: '60.00% - 79.99%', area: 2029.289376, share: 11.575409 },
  { label: '40.00% - 59.99%', area: 4777.193111, share: 27.249916 },
  { label: '25.00% - 39.99%', area: 611.73629, share: 3.489447 },
];

export const changeSummary = {
  changedPlots: 67,
  passedToIncomplete: 47,
  beforePassed: 100,
  afterPassed: 70,
  comparison: [
    { statusThai: 'ผ่านเกณฑ์', 'ก่อนอัปเดต': 100, 'หลังอัปเดต': 70 },
    { statusThai: 'ดำเนินการเพิ่ม', 'ก่อนอัปเดต': 13, 'หลังอัปเดต': 52 },
    { statusThai: 'ไม่ผ่าน', 'ก่อนอัปเดต': 7, 'หลังอัปเดต': 8 },
    { statusThai: 'รอตรวจนับ', 'ก่อนอัปเดต': 11, 'หลังอัปเดต': 1 },
  ],
};

export const failPlots = [
  { id: '36-VSD', province: 'พังงา', group: 'G1 - Wisutti / Premium', projectId: 'g1-wisutti', survival: 0 },
  { id: '36-STC', province: 'ฉะเชิงเทรา', group: 'G1 - Siam TC / Premium', projectId: 'g1-siam-tc', survival: 0 },
  { id: '91-VSD', province: 'ปัตตานี', group: 'G1 - Wisutti / Premium', projectId: 'g1-wisutti', survival: 0 },
  { id: '92-VSD', province: 'ปัตตานี', group: 'G1 - Wisutti / Premium', projectId: 'g1-wisutti', survival: 0 },
  { id: '35-STC', province: 'กระบี่', group: 'G1 - Siam TC / Premium', projectId: 'g1-siam-tc', survival: 5 },
  { id: '69-STC', province: 'พังงา', group: 'G2 - Siam TC / Standard', projectId: 'g2-siam-tc', survival: 10 },
  { id: '68-STC', province: 'พังงา', group: 'G2 - Siam TC / Standard', projectId: 'g2-siam-tc', survival: 10 },
  { id: '7-VSD', province: 'ตราด', group: 'G1 - Wisutti / Premium', projectId: 'g1-wisutti', survival: 12.36 },
];

export const adjustedSummary = {
  belowPassedArea: 7839.781577,
  annualEstimate: 73693.9468238,
  sevenYearEstimate: 1153542.3140206002,
  factor: 9.4,
  years: 7,
};
