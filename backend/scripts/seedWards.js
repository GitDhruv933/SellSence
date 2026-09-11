const { getDb } = require('../db.js');

const PRESET_WARDS = [
  { name: 'Ward 1',  population_density: 12100, household_density: 3100, sws_percent: 22 },
  { name: 'Ward 2',  population_density: 14800, household_density: 3800, sws_percent: 27 },
  { name: 'Ward 3',  population_density: 17300, household_density: 4500, sws_percent: 31 },
  { name: 'Ward 4',  population_density: 19900, household_density: 5200, sws_percent: 35 },
  { name: 'Ward 5',  population_density: 21600, household_density: 5700, sws_percent: 38 },
  { name: 'Ward 6',  population_density: 23800, household_density: 6300, sws_percent: 41 },
  { name: 'Ward 7',  population_density: 18500, household_density: 4200, sws_percent: 12 },
  { name: 'Ward 8',  population_density: 25000, household_density: 5000, sws_percent: 8  },
  { name: 'Ward 9',  population_density: 25000, household_density: 9000, sws_percent: 9  },
  { name: 'Ward 10', population_density: 22600, household_density: 6100, sws_percent: 19 },
  { name: 'Ward 11', population_density: 20400, household_density: 5400, sws_percent: 24 },
  { name: 'Ward 12', population_density: 16200, household_density: 4300, sws_percent: 29 },
  { name: 'Ward 13', population_density: 13900, household_density: 3600, sws_percent: 33 },
  { name: 'Ward 14', population_density: 11700, household_density: 3000, sws_percent: 26 },
  { name: 'Ward 15', population_density: 19300, household_density: 5000, sws_percent: 16 },
  { name: 'Ward 16', population_density: 22100, household_density: 5800, sws_percent: 21 },
  { name: 'Ward 17', population_density: 24700, household_density: 6600, sws_percent: 30 },
  { name: 'Ward 18', population_density: 26800, household_density: 7300, sws_percent: 43 },
  { name: 'Ward 19', population_density: 15400, household_density: 4000, sws_percent: 18 },
  { name: 'Ward 20', population_density: 18200, household_density: 4700, sws_percent: 23 },
  { name: 'Ward 21', population_density: 20900, household_density: 5500, sws_percent: 36 },
  { name: 'Ward 22', population_density: 13500, household_density: 3500, sws_percent: 15 },
  { name: 'Ward 23', population_density: 11000, household_density: 2900, sws_percent: 11 },
  { name: 'Ward 24', population_density: 19600, household_density: 5100, sws_percent: 28 },
];

const db = getDb();

// Only insert if the table is empty (safe to re-run)
const existing = db.prepare('SELECT COUNT(*) as c FROM wards').get();
if (existing.c > 0) {
  console.log('Wards table already has rows — skipping seed.');
  process.exit(0);
}

const insert = db.prepare(
  `INSERT INTO wards (name, is_target, population_density, household_density, sws_percent, boundary_geojson, category, pca_score)
   VALUES (?, 0, ?, ?, ?, NULL, NULL, NULL)`
);

for (const w of PRESET_WARDS) {
  insert.run(w.name, w.population_density, w.household_density, w.sws_percent);
}

console.log('Seeded 24 preset wards into the database.');
