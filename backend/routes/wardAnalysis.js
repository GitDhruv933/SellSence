// routes/wardAnalysis.js - Ward-level market expansion analysis.
//
// Steps 1-2 (ward boundary + WorldPop/GHSL cross-check, and entering the
// census-style indicators for the target ward + up to 24 comparison
// wards) are handled by /wards and /boundary below. Steps 3-6
// (min-max normalization -> KMO/Bartlett -> PCA -> SD-based
// classification) are delegated to scripts/ward_pca.py, which mirrors
// the paper's Eq. 1-3 / Table 5 methodology without needing SPSS.
// Step 7 (map colored by category) is rendered client-side from the
// `category` + `boundary_geojson` this route returns.
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

const INDICATORS = ['population_density', 'household_density', 'sws_percent'];
const PYTHON_BIN = process.env.WARD_PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'ward_pca.py');

function serializeWard(row) {
  return {
    id: row.id,
    name: row.name,
    is_target: !!row.is_target,
    population_density: row.population_density,
    household_density: row.household_density,
    sws_percent: row.sws_percent,
    area_sq_km: row.area_sq_km,
    population_worldpop: row.population_worldpop,
    built_up_density_ghsl: row.built_up_density_ghsl,
    boundary_geojson: row.boundary_geojson ? JSON.parse(row.boundary_geojson) : null,
    pca_score: row.pca_score,
    category: row.category,
    updated_at: row.updated_at,
  };
}

// GET /ward-analysis/wards - list all wards the vendor has entered so far
router.get('/wards', (req, res) => {
  const rows = db.prepare('SELECT * FROM wards WHERE user_id = ? ORDER BY is_target DESC, name ASC').all(req.userId);
  res.json({ wards: rows.map(serializeWard) });
});

// POST /ward-analysis/wards - bulk create/replace the ward list
// Body: { wards: [{ name, is_target, population_density, household_density, sws_percent }, ...] }
// Replaces the vendor's whole ward set each call, which keeps "target ward
// + up to 24 others" easy to manage from a single editable table on the
// frontend instead of juggling individual row IDs.
router.post('/wards', (req, res) => {
  const { wards } = req.body;
  if (!Array.isArray(wards) || wards.length === 0) {
    return res.status(400).json({ error: 'wards must be a non-empty array' });
  }
  for (const w of wards) {
    if (!w.name || typeof w.name !== 'string') {
      return res.status(400).json({ error: 'Every ward needs a name' });
    }
    for (const ind of INDICATORS) {
      if (w[ind] !== undefined && w[ind] !== null && Number.isNaN(Number(w[ind]))) {
        return res.status(400).json({ error: `${ind} must be numeric for ward "${w.name}"` });
      }
    }
  }
  if (wards.length > 25) {
    return res.status(400).json({ error: 'This methodology expects one target ward plus up to 24 comparison wards (25 max).' });
  }
  const targetCount = wards.filter((w) => w.is_target).length;
  if (targetCount > 1) {
    return res.status(400).json({ error: 'Only one ward can be flagged as the target ward' });
  }

  const result = db.transaction(() => {
    db.prepare('DELETE FROM wards WHERE user_id = ?').run(req.userId);
    const insert = db.prepare(`
      INSERT INTO wards (user_id, name, is_target, population_density, household_density, sws_percent)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const w of wards) {
      insert.run(
        req.userId,
        w.name,
        w.is_target ? 1 : 0,
        w.population_density ?? null,
        w.household_density ?? null,
        w.sws_percent ?? null
      );
    }
    return db.prepare('SELECT * FROM wards WHERE user_id = ? ORDER BY is_target DESC, name ASC').all(req.userId);
  })();

  res.json({ wards: result.map(serializeWard) });
});

// POST /ward-analysis/boundary/:wardId - attach Step 1 output (ward
// boundary GeoJSON + area, and the WorldPop/GHSL cross-check numbers) to
// one ward. Meant to be filled in from the output of
// scripts/gee_ward_boundary.py, which needs the vendor's own Earth Engine
// account and so is run outside this app rather than by the backend.
router.post('/boundary/:wardId', (req, res) => {
  const { wardId } = req.params;
  const { boundary_geojson, area_sq_km, population_worldpop, built_up_density_ghsl } = req.body;
  const ward = db.prepare('SELECT * FROM wards WHERE id = ? AND user_id = ?').get(wardId, req.userId);
  if (!ward) return res.status(404).json({ error: 'Ward not found' });

  if (boundary_geojson !== undefined) {
    try {
      if (boundary_geojson !== null) JSON.stringify(boundary_geojson) && JSON.parse(JSON.stringify(boundary_geojson));
    } catch {
      return res.status(400).json({ error: 'boundary_geojson must be valid GeoJSON' });
    }
  }

  db.prepare(`
    UPDATE wards SET
      boundary_geojson = COALESCE(?, boundary_geojson),
      area_sq_km = COALESCE(?, area_sq_km),
      population_worldpop = COALESCE(?, population_worldpop),
      built_up_density_ghsl = COALESCE(?, built_up_density_ghsl),
      updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    boundary_geojson !== undefined ? JSON.stringify(boundary_geojson) : null,
    area_sq_km ?? null,
    population_worldpop ?? null,
    built_up_density_ghsl ?? null,
    wardId,
    req.userId
  );

  const updated = db.prepare('SELECT * FROM wards WHERE id = ?').get(wardId);
  res.json({ ward: serializeWard(updated) });
});

// POST /ward-analysis/classify - Steps 3-6: normalize, check KMO/Bartlett,
// run PCA, classify by SD band. Runs scripts/ward_pca.py as a subprocess
// so the actual stats stay in one Python file that's easy to check
// against the paper's equations independently of the Node backend.
router.post('/classify', (req, res) => {
  const rows = db.prepare('SELECT * FROM wards WHERE user_id = ?').all(req.userId);
  if (rows.length < 3) {
    return res.status(400).json({ error: 'Add at least 3 wards (ideally the target ward plus all 24 others) before classifying.' });
  }
  const missing = rows.filter((r) => INDICATORS.some((ind) => r[ind] === null || r[ind] === undefined));
  if (missing.length > 0) {
    return res.status(400).json({
      error: `These wards are missing one or more indicators: ${missing.map((w) => w.name).join(', ')}`,
    });
  }

  const payload = {
    indicators: INDICATORS,
    wards: rows.map((r) => ({
      name: r.name,
      is_target: !!r.is_target,
      population_density: r.population_density,
      household_density: r.household_density,
      sws_percent: r.sws_percent,
    })),
  };

  const py = spawn(PYTHON_BIN, [SCRIPT_PATH]);
  let stdout = '';
  let stderr = '';
  py.stdout.on('data', (d) => { stdout += d; });
  py.stderr.on('data', (d) => { stderr += d; });

  py.on('error', (err) => {
    res.status(500).json({ error: `Could not start ${PYTHON_BIN}: ${err.message}. Set WARD_PYTHON_BIN if python3 is not on PATH.` });
  });

  py.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'ward_pca.py failed', details: stderr || stdout });
    }
    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      return res.status(500).json({ error: 'Could not parse ward_pca.py output', details: stdout });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const update = db.prepare('UPDATE wards SET pca_score = ?, category = ?, updated_at = datetime(\'now\') WHERE user_id = ? AND name = ?');
    db.transaction(() => {
      for (const w of result.wards) {
        update.run(w.pca_score, w.category, req.userId, w.name);
      }
    })();

    const updatedRows = db.prepare('SELECT * FROM wards WHERE user_id = ? ORDER BY is_target DESC, pca_score DESC').all(req.userId);
    res.json({
      diagnostics: result.diagnostics,
      warnings: result.warnings,
      pca: result.pca,
      classification: result.classification,
      wards: updatedRows.map(serializeWard),
    });
  });

  py.stdin.write(JSON.stringify(payload));
  py.stdin.end();
});

module.exports = router;
