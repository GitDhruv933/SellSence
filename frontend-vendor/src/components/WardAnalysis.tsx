import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, MapPin, Loader2, AlertTriangle, CheckCircle2, Map as MapIcon } from 'lucide-react';
import { ApiError, wardApi } from '@/api/client';
import type { Ward, WardClassifyResponse, WardGeometry } from '@/api/types';

// Steps 1-7 of the ward market-expansion methodology, run from this tab:
//   1. Ward boundary + area (Earth Engine), cross-checked with WorldPop
//      population and GHSL built-up density — run gee_ward_boundary.py on
//      your own machine (needs your own Earth Engine login) and paste its
//      output here, or attach a plain GeoJSON boundary you already have.
//   2. Enter the census-style indicators for the target ward + up to 24
//      comparison wards in the table below.
//   3-6. "Run classification" sends everything to the backend, which runs
//      scripts/ward_pca.py: min-max normalization -> KMO/Bartlett check ->
//      PCA -> SD-based 5-band classification.
//   7. The map at the bottom renders each ward's boundary colored by its
//      resulting category.

type EditableWard = Partial<Ward> & { _localId: string };

const INDICATOR_FIELDS = [
  { key: 'population_density', label: 'Population density' },
  { key: 'household_density', label: 'Household density' },
  { key: 'sws_percent', label: 'SWS %' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Very Low': '#22c55e',
  Low: '#86efac',
  Medium: '#fde047',
  High: '#fb923c',
  'Very High': '#ef4444',
};

function emptyRow(): EditableWard {
  return { _localId: crypto.randomUUID(), name: '', is_target: false };
}

function toNumOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// --- Step 7 helpers: project each ward's boundary GeoJSON into a shared
// SVG viewBox and render it colored by category. No mapping library
// dependency — this is a plain equirectangular projection, good enough
// for a same-city set of ward polygons.

function outerRings(geom: WardGeometry | null | undefined): number[][][] {
  if (!geom) return [];
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as number[][][];
    return rings?.[0] ? [rings[0]] : [];
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as number[][][][];
    return (polys || []).map((p) => p[0]).filter(Boolean);
  }
  return [];
}

function WardMap({ wards }: { wards: Ward[] }) {
  const withBoundary = wards.filter((w) => w.boundary_geojson);
  const width = 560;
  const height = 420;
  const pad = 16;

  const allPoints = withBoundary.flatMap((w) => outerRings(w.boundary_geojson).flat());
  if (allPoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center py-12 text-gray-400 text-sm">
        <MapIcon className="w-8 h-8" />
        No ward boundaries attached yet. Paste GeoJSON for a ward below to see it here.
      </div>
    );
  }

  const lons = allPoints.map((p) => p[0]);
  const lats = allPoints.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonSpan = maxLon - minLon || 1;
  const latSpan = maxLat - minLat || 1;
  // Preserve aspect ratio roughly (equirectangular, fine at city scale).
  const scale = Math.min((width - 2 * pad) / lonSpan, (height - 2 * pad) / latSpan);

  const project = (lon: number, lat: number) => {
    const x = pad + (lon - minLon) * scale;
    const y = height - pad - (lat - minLat) * scale; // flip so north is up
    return [x, y];
  };

  const ringToPath = (ring: number[][]) =>
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-gray-50 rounded-xl border border-gray-100">
      {withBoundary.map((w) => {
        const color = (w.category && CATEGORY_COLORS[w.category]) || '#cbd5e1';
        return outerRings(w.boundary_geojson).map((ring, i) => (
          <path
            key={`${w.id}-${i}`}
            d={ringToPath(ring)}
            fill={color}
            fillOpacity={0.75}
            stroke={w.is_target ? '#1d4ed8' : '#ffffff'}
            strokeWidth={w.is_target ? 2.5 : 1}
          >
            <title>
              {w.name} — {w.category ?? 'not yet classified'}
              {w.pca_score !== null ? ` (score ${w.pca_score.toFixed(2)})` : ''}
            </title>
          </path>
        ));
      })}
    </svg>
  );
}

export default function WardAnalysis() {
  const [wards, setWards] = useState<EditableWard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WardClassifyResponse | null>(null);
  const [boundaryDraftFor, setBoundaryDraftFor] = useState<string | null>(null);
  const [boundaryText, setBoundaryText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { wards: fetched } = await wardApi.list();
        setWards(
          fetched.length
            ? fetched.map((w) => ({ ...w, _localId: String(w.id) }))
            : [{ ...emptyRow(), is_target: true }]
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load wards');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const targetCount = wards.filter((w) => w.is_target).length;

  const updateRow = (localId: string, patch: Partial<EditableWard>) => {
    setWards((prev) => prev.map((w) => (w._localId === localId ? { ...w, ...patch } : w)));
  };

  const setTarget = (localId: string) => {
    setWards((prev) => prev.map((w) => ({ ...w, is_target: w._localId === localId })));
  };

  const addRow = () => {
    if (wards.length >= 25) return;
    setWards((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (localId: string) => {
    setWards((prev) => prev.filter((w) => w._localId !== localId));
  };

  const saveWards = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = wards
        .filter((w) => w.name && w.name.trim() !== '')
        .map((w) => ({
          name: w.name,
          is_target: !!w.is_target,
          population_density: w.population_density ?? null,
          household_density: w.household_density ?? null,
          sws_percent: w.sws_percent ?? null,
        }));
      const { wards: saved } = await wardApi.saveAll(payload);
      setWards(saved.map((w) => ({ ...w, _localId: String(w.id) })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save wards');
    } finally {
      setSaving(false);
    }
  };

  const openBoundaryDraft = (localId: string, current?: WardGeometry | null) => {
    setBoundaryDraftFor(localId);
    setBoundaryText(current ? JSON.stringify(current, null, 2) : '');
  };

  const attachBoundary = async (w: EditableWard) => {
    if (!w.id) {
      setError('Save the ward first (so it has an ID), then attach its boundary.');
      return;
    }
    let geom: unknown;
    try {
      const parsed = JSON.parse(boundaryText);
      geom = parsed.type === 'Feature' ? parsed.geometry : parsed;
    } catch {
      setError('Boundary must be valid GeoJSON (paste the output of gee_ward_boundary.py, or a Polygon/MultiPolygon geometry).');
      return;
    }
    try {
      const { ward } = await wardApi.attachBoundary(w.id, { boundary_geojson: geom });
      setWards((prev) => prev.map((row) => (row._localId === w._localId ? { ...ward, _localId: String(ward.id) } : row)));
      setBoundaryDraftFor(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not attach boundary');
    }
  };

  const runClassification = async () => {
    setClassifying(true);
    setError(null);
    setResult(null);
    try {
      const res = await wardApi.classify();
      setResult(res);
      setWards(res.wards.map((w) => ({ ...w, _localId: String(w.id) })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Classification failed');
    } finally {
      setClassifying(false);
    }
  };

  const wardsWithBoundary = useMemo(
    () => wards.filter((w): w is EditableWard & Ward => !!w.id),
    [wards]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Ward market-expansion analysis</h3>
        <p className="text-sm text-gray-400">
          Mark your target ward, add up to 24 comparison wards with their indicators, then run the
          classification. Boundary GeoJSON (Step 1, from Earth Engine) is optional per ward but needed
          for the map at the bottom.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {targetCount !== 1 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Pick exactly one ward as the target (use the radio button in the first column).</span>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Target</th>
              <th className="px-3 py-2 text-left font-semibold">Ward name</th>
              {INDICATOR_FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2 text-left font-semibold">{f.label}</th>
              ))}
              <th className="px-3 py-2 text-left font-semibold">Boundary</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {wards.map((w) => (
              <tr key={w._localId}>
                <td className="px-3 py-2">
                  <input type="radio" checked={!!w.is_target} onChange={() => setTarget(w._localId)} />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-32 rounded-lg border border-gray-200 px-2 py-1"
                    value={w.name ?? ''}
                    onChange={(e) => updateRow(w._localId, { name: e.target.value })}
                    placeholder="Ward 7"
                  />
                </td>
                {INDICATOR_FIELDS.map((f) => (
                  <td key={f.key} className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1"
                      value={w[f.key] ?? ''}
                      onChange={(e) => updateRow(w._localId, { [f.key]: toNumOrNull(e.target.value) } as Partial<EditableWard>)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <button
                    onClick={() => openBoundaryDraft(w._localId, w.boundary_geojson)}
                    className="flex items-center gap-1 text-xs font-semibold text-accent-600 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {w.boundary_geojson ? 'Edit' : 'Attach'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {w.category ? (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: CATEGORY_COLORS[w.category] ?? '#94a3b8' }}
                    >
                      {w.category}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => removeRow(w._localId)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {boundaryDraftFor && (
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2">
          <p className="text-xs text-gray-500">
            Paste the JSON printed by <code>gee_ward_boundary.py</code> (or any Polygon/MultiPolygon GeoJSON) for this ward.
          </p>
          <textarea
            value={boundaryText}
            onChange={(e) => setBoundaryText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={() => attachBoundary(wards.find((w) => w._localId === boundaryDraftFor)!)}
              className="px-3 py-1.5 rounded-lg bg-accent-500 text-white text-xs font-semibold"
            >
              Save boundary
            </button>
            <button onClick={() => setBoundaryDraftFor(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={addRow}
          disabled={wards.length >= 25}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Add ward ({wards.length}/25)
        </button>
        <button
          onClick={saveWards}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save wards'}
        </button>
        <button
          onClick={runClassification}
          disabled={classifying}
          className="px-4 py-2 rounded-xl bg-accent-500 text-white text-sm font-semibold disabled:opacity-50"
        >
          {classifying ? 'Running…' : 'Run classification'}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-gray-100 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sampling adequacy (Step 4)
            </h4>
            <p className="text-sm text-gray-600">
              KMO: <strong>{result.diagnostics.kmo}</strong> ({result.diagnostics.kmo_adequacy})
            </p>
            <p className="text-sm text-gray-600">
              Bartlett's test: χ² = {result.diagnostics.bartlett_chi_square}, df = {result.diagnostics.bartlett_df}
              {result.diagnostics.bartlett_p_value !== null && `, p = ${result.diagnostics.bartlett_p_value}`}
            </p>
            {result.warnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="border border-gray-100 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">PCA (Step 5)</h4>
            <p className="text-sm text-gray-600">
              Components kept (eigenvalue ≥ 1): <strong>{result.pca.components_kept}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Total variance explained: <strong>{result.pca.total_variance_explained_pct}%</strong>
            </p>
            <p className="text-sm text-gray-600">
              Score mean {result.classification.mean_score}, SD {result.classification.sd_score}
            </p>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-semibold text-sm text-gray-900 mb-2 flex items-center gap-1.5">
          <MapIcon className="w-4 h-4" /> Step 7 — wards colored by category
        </h4>
        <WardMap wards={wardsWithBoundary} />
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(CATEGORY_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
