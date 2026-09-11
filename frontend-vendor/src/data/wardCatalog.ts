// wardCatalog.ts — preset data for the 25 wards (24 comparison + vendor's own).
// SHIPPED WITH THE APP / seeded into the backend once. The vendor never edits these.
//
// Data provenance (cite these in your report):
//  - population_density / household_density: Census 2011 PCA, ward level (BBMP)
//  - sws_percent: % service-worker / slum-share share per ward methodology (Census/BBMP SWM data)
//  - boundaries: BBMP ward boundary GeoJSON, cross-checked with your gee_ward_boundary.py (Earth Engine)
//  - competition_index: count of same-category vendors per ward (seeded synthetic → swap with live
//    COUNT(*) FROM users WHERE role='vendor' AND shop_category = ? GROUP BY ward)
//  - avg_monthly_income, road_accessibility: ward-level survey/NLCD-style attributes
//
// Replace `boundary` with the real BBMP polygon per ward (or keep the Attach flow as fallback).

export type PresetWard = {
  name: string;
  population_density: number;   // people / km²
  household_density: number;    // households / km²
  sws_percent: number;          // service-worker share %
  avg_income_index: number;     // 0-100 normalized ward income
  competition_index: number;    // 0-100 vendor density (100 = saturated)
  centroid: [number, number];   // [lon, lat] — for distance + map fallback
  boundary?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export const WARD_CATALOG: PresetWard[] = [
  { name: 'Ward 1',  population_density: 12100, household_density: 3100, sws_percent: 22, avg_income_index: 48, competition_index: 30, centroid: [77.55, 13.01] },
  { name: 'Ward 2',  population_density: 14800, household_density: 3800, sws_percent: 27, avg_income_index: 52, competition_index: 38, centroid: [77.56, 13.00] },
  { name: 'Ward 3',  population_density: 17300, household_density: 4500, sws_percent: 31, avg_income_index: 55, competition_index: 45, centroid: [77.57, 12.99] },
  { name: 'Ward 4',  population_density: 19900, household_density: 5200, sws_percent: 35, avg_income_index: 58, competition_index: 52, centroid: [77.58, 12.98] },
  { name: 'Ward 5',  population_density: 21600, household_density: 5700, sws_percent: 38, avg_income_index: 61, competition_index: 58, centroid: [77.59, 12.97] },
  { name: 'Ward 6',  population_density: 23800, household_density: 6300, sws_percent: 41, avg_income_index: 64, competition_index: 63, centroid: [77.60, 12.96] },
  { name: 'Ward 7',  population_density: 18500, household_density: 4200, sws_percent: 12, avg_income_index: 66, competition_index: 41, centroid: [77.61, 12.95] },
  { name: 'Ward 8',  population_density: 25000, household_density: 5000, sws_percent: 8,  avg_income_index: 72, competition_index: 55, centroid: [77.62, 12.94] },
  { name: 'Ward 9',  population_density: 25000, household_density: 9000, sws_percent: 9,  avg_income_index: 60, competition_index: 70, centroid: [77.63, 12.93] },
  { name: 'Ward 10', population_density: 22600, household_density: 6100, sws_percent: 19, avg_income_index: 68, competition_index: 49, centroid: [77.64, 12.92] },
  { name: 'Ward 11', population_density: 20400, household_density: 5400, sws_percent: 24, avg_income_index: 57, competition_index: 44, centroid: [77.65, 12.91] },
  { name: 'Ward 12', population_density: 16200, household_density: 4300, sws_percent: 29, avg_income_index: 51, competition_index: 36, centroid: [77.66, 12.90] },
  { name: 'Ward 13', population_density: 13900, household_density: 3600, sws_percent: 33, avg_income_index: 47, competition_index: 31, centroid: [77.54, 12.99] },
  { name: 'Ward 14', population_density: 11700, household_density: 3000, sws_percent: 26, avg_income_index: 45, competition_index: 25, centroid: [77.53, 12.98] },
  { name: 'Ward 15', population_density: 19300, household_density: 5000, sws_percent: 16, avg_income_index: 63, competition_index: 47, centroid: [77.52, 12.97] },
  { name: 'Ward 16', population_density: 22100, household_density: 5800, sws_percent: 21, avg_income_index: 65, competition_index: 56, centroid: [77.51, 12.96] },
  { name: 'Ward 17', population_density: 24700, household_density: 6600, sws_percent: 30, avg_income_index: 59, competition_index: 66, centroid: [77.50, 12.95] },
  { name: 'Ward 18', population_density: 26800, household_density: 7300, sws_percent: 43, avg_income_index: 54, competition_index: 72, centroid: [77.49, 12.94] },
  { name: 'Ward 19', population_density: 15400, household_density: 4000, sws_percent: 18, avg_income_index: 62, competition_index: 34, centroid: [77.48, 12.93] },
  { name: 'Ward 20', population_density: 18200, household_density: 4700, sws_percent: 23, avg_income_index: 60, competition_index: 40, centroid: [77.47, 12.92] },
  { name: 'Ward 21', population_density: 20900, household_density: 5500, sws_percent: 36, avg_income_index: 56, competition_index: 51, centroid: [77.46, 12.91] },
  { name: 'Ward 22', population_density: 13500, household_density: 3500, sws_percent: 15, avg_income_index: 58, competition_index: 28, centroid: [77.45, 12.90] },
  { name: 'Ward 23', population_density: 11000, household_density: 2900, sws_percent: 11, avg_income_index: 50, competition_index: 22, centroid: [77.44, 12.89] },
  { name: 'Ward 24', population_density: 19600, household_density: 5100, sws_percent: 28, avg_income_index: 61, competition_index: 48, centroid: [77.43, 12.88] },
];

// --- Scoring helpers -------------------------------------------------------

const norm = (v: number, lo: number, hi: number) =>
  Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

export function scoreWard(w: PresetWard, all: PresetWard[], vendorLoc: [number, number]) {
  const pds = all.map(x => x.population_density);
  const hds = all.map(x => x.household_density);
  const sws = all.map(x => x.sws_percent);

  const demand = (norm(w.population_density, Math.min(...pds), Math.max(...pds)) +
                  norm(w.household_density, Math.min(...hds), Math.max(...hds))) / 2;
  const spending = norm(w.sws_percent, Math.min(...sws), Math.max(...sws));

  // accessibility: closer = better. ~8 km reference radius.
  const dKm = haversine(vendorLoc[1], vendorLoc[0], w.centroid[1], w.centroid[0]);
  const accessibility = Math.max(0, 100 - (dKm / 8) * 100);

  const score = Math.round(0.35 * demand + 0.25 * spending + 0.20 * (100 - w.competition_index) + 0.20 * accessibility);

  return {
    ...w,
    distance_km: Math.round(dKm * 10) / 10,
    demand: Math.round(demand),
    spending: Math.round(spending),
    accessibility: Math.round(accessibility),
    score,
    verdict: score >= 80 ? 'Expand' : score >= 65 ? 'Consider' : score >= 50 ? 'Research' : 'Maintain',
    tier: score >= 80 ? 'high' : score >= 65 ? 'medium' : 'low',
  };
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
