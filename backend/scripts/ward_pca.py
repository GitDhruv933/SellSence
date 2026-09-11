#!/usr/bin/env python3
"""
ward_pca.py

Steps 3-6 of the ward classification methodology, done in Python instead
of SPSS:

  Step 3 - Min-max normalization of raw census-style indicators (Eq. 1)
  Step 4 - Sampling-adequacy checks: KMO measure + Bartlett's test of
           sphericity, to confirm the indicator set is actually suitable
           for PCA before running it
  Step 5 - Principal Component Analysis, reduced to a single composite
           score per ward via variance-weighted combination of the
           components with eigenvalue >= 1 (Kaiser criterion) (Eq. 2)
  Step 6 - Standard-deviation based classification of the composite score
           into 5 categories (Eq. 3), matching a typical "Table 5" style
           write-up (Very Low / Low / Medium / High / Very High)

Usage:
    python3 ward_pca.py < input.json > output.json

Input JSON shape:
{
  "indicators": ["population_density", "household_density", "sws_percent"],
  "wards": [
    {"name": "Ward 1", "is_target": false, "population_density": 123.4,
     "household_density": 45.6, "sws_percent": 12.3},
    ...
  ],
  "reverse_indicators": []   // optional: indicator names where LOWER raw
                              // value should count as MORE deprived/severe
                              // (their normalization is flipped before PCA)
}

Needs at least ~5-6 wards for PCA/KMO/Bartlett to mean anything, and the
paper's own methodology assumes the full set of 25 wards is comparable.
With fewer than 3 wards this script will refuse to run PCA at all.

No third-party stats packages required beyond numpy/scipy/scikit-learn
(all already needed for PCA), so there is no dependency on SPSS or on
`factor_analyzer` - KMO and Bartlett's test are computed directly from
the correlation matrix using the standard textbook formulas.
"""
import sys
import json
import numpy as np
from sklearn.decomposition import PCA


def min_max_normalize(matrix: np.ndarray, reverse_mask: np.ndarray) -> np.ndarray:
    """Eq. 1 — column-wise min-max normalization to [0, 1].
    For indicators flagged as 'reverse', normalization is inverted so that,
    same as every other indicator, a higher normalized value always means
    'more of the thing the index is measuring' (e.g. more deprivation).
    """
    mins = matrix.min(axis=0)
    maxs = matrix.max(axis=0)
    span = np.where((maxs - mins) == 0, 1.0, maxs - mins)  # guard div-by-zero
    norm = (matrix - mins) / span
    norm[:, reverse_mask] = 1.0 - norm[:, reverse_mask]
    return norm


def kmo_bartlett(standardized: np.ndarray):
    """Kaiser-Meyer-Olkin measure of sampling adequacy + Bartlett's test of
    sphericity, computed directly from the correlation matrix (the same
    quantities SPSS's Factor Analysis dialog reports)."""
    n, p = standardized.shape
    corr = np.corrcoef(standardized, rowvar=False)

    # --- Bartlett's test of sphericity ---
    det = np.linalg.det(corr)
    det = max(det, 1e-12)  # guard log(0)
    chi_square = -(n - 1 - (2 * p + 5) / 6) * np.log(det)
    df = p * (p - 1) / 2
    try:
        from scipy.stats import chi2
        p_value = float(1 - chi2.cdf(chi_square, df))
    except Exception:
        p_value = None

    # --- KMO measure of sampling adequacy ---
    try:
        inv_corr = np.linalg.pinv(corr)
    except np.linalg.LinAlgError:
        inv_corr = np.eye(p)
    diag_inv = np.sqrt(np.diag(inv_corr))
    denom_outer = np.outer(diag_inv, diag_inv)
    denom_outer = np.where(denom_outer == 0, 1e-12, denom_outer)
    partial = -inv_corr / denom_outer
    np.fill_diagonal(partial, 0)
    r_offdiag = corr.copy()
    np.fill_diagonal(r_offdiag, 0)

    sum_r2 = np.sum(r_offdiag ** 2)
    sum_partial2 = np.sum(partial ** 2)
    kmo_overall = sum_r2 / (sum_r2 + sum_partial2) if (sum_r2 + sum_partial2) > 0 else float("nan")

    return {
        "kmo": round(float(kmo_overall), 4),
        "kmo_adequacy": kmo_label(kmo_overall),
        "bartlett_chi_square": round(float(chi_square), 4),
        "bartlett_df": int(df),
        "bartlett_p_value": None if p_value is None else round(p_value, 6),
        "bartlett_significant": None if p_value is None else bool(p_value < 0.05),
    }


def kmo_label(value: float) -> str:
    if np.isnan(value):
        return "undefined"
    if value >= 0.9:
        return "marvelous"
    if value >= 0.8:
        return "meritorious"
    if value >= 0.7:
        return "middling"
    if value >= 0.6:
        return "mediocre"
    if value >= 0.5:
        return "miserable"
    return "unacceptable"


def sd_classify(scores: np.ndarray):
    """Eq. 3 — standard-deviation based classification into 5 bands.
    Same scheme as the paper's Table 5: bands are cut at +/-0.5 SD and
    +/-1.5 SD from the mean of the composite score across all wards.
    """
    mean = scores.mean()
    sd = scores.std(ddof=1) if len(scores) > 1 else 0.0
    labels = []
    for s in scores:
        if sd == 0:
            labels.append("Medium")
            continue
        z = (s - mean) / sd
        if z < -1.5:
            labels.append("Very Low")
        elif z < -0.5:
            labels.append("Low")
        elif z <= 0.5:
            labels.append("Medium")
        elif z <= 1.5:
            labels.append("High")
        else:
            labels.append("Very High")
    return labels, float(mean), float(sd)


def main():
    payload = json.load(sys.stdin)
    indicators = payload["indicators"]
    wards = payload["wards"]
    reverse = set(payload.get("reverse_indicators", []))
    reverse_mask = np.array([name in reverse for name in indicators])

    names = [w["name"] for w in wards]
    is_target = [bool(w.get("is_target", False)) for w in wards]
    raw = np.array([[float(w[ind]) for ind in indicators] for w in wards])

    n_wards, n_ind = raw.shape
    if n_wards < 3:
        print(json.dumps({
            "error": "Need at least 3 wards (ideally all 25) to run PCA. "
                     f"Only {n_wards} were provided."
        }))
        sys.exit(1)

    # Step 3: min-max normalization
    normalized = min_max_normalize(raw, reverse_mask)

    # Standardize the normalized indicators before PCA (equivalent to
    # running PCA on the correlation matrix, which is what KMO/Bartlett
    # are evaluating the suitability of).
    means = normalized.mean(axis=0)
    stds = normalized.std(axis=0, ddof=1)
    stds_safe = np.where(stds == 0, 1.0, stds)
    standardized = (normalized - means) / stds_safe

    # Step 4: KMO + Bartlett
    diagnostics = kmo_bartlett(standardized)
    diagnostics["n_wards"] = n_wards
    diagnostics["n_indicators"] = n_ind
    warnings = []
    if n_wards < 25:
        warnings.append(
            f"Only {n_wards}/25 wards supplied - PCA scores and the SD "
            "classification will shift once the remaining wards are added."
        )
    if not np.isnan(diagnostics["kmo"]) and diagnostics["kmo"] < 0.5:
        warnings.append(
            "KMO is below 0.5 ('unacceptable') - PCA is not really "
            "justified on this indicator set as-is."
        )
    if diagnostics["bartlett_p_value"] is not None and diagnostics["bartlett_p_value"] >= 0.05:
        warnings.append(
            "Bartlett's test is not significant (p >= 0.05) - the "
            "indicators may be too uncorrelated for PCA to summarize well."
        )

    # Step 5: PCA, Kaiser criterion (eigenvalue >= 1), variance-weighted
    # composite score (Eq. 2)
    pca = PCA(n_components=n_ind)
    scores = pca.fit_transform(standardized)
    eigenvalues = pca.explained_variance_
    explained_ratio = pca.explained_variance_ratio_

    keep = eigenvalues >= 1.0
    if not keep.any():
        keep = np.zeros(n_ind, dtype=bool)
        keep[0] = True  # always keep PC1 as a fallback

    weights = explained_ratio[keep] / explained_ratio[keep].sum()
    composite = (scores[:, keep] * weights).sum(axis=1)

    categories, mean_score, sd_score = sd_classify(composite)

    components_kept = int(keep.sum())
    loadings = pca.components_[keep] * np.sqrt(eigenvalues[keep])[:, None]

    result = {
        "diagnostics": diagnostics,
        "warnings": warnings,
        "pca": {
            "components_kept": components_kept,
            "explained_variance_ratio": [round(float(v), 4) for v in explained_ratio[keep]],
            "total_variance_explained_pct": round(float(explained_ratio[keep].sum() * 100), 2),
            "loadings": {
                indicators[i]: [round(float(loadings[c, i]), 4) for c in range(components_kept)]
                for i in range(n_ind)
            },
        },
        "classification": {
            "mean_score": round(mean_score, 4),
            "sd_score": round(sd_score, 4),
        },
        "wards": [
            {
                "name": names[i],
                "is_target": is_target[i],
                "normalized": {indicators[j]: round(float(normalized[i, j]), 4) for j in range(n_ind)},
                "pca_score": round(float(composite[i]), 4),
                "category": categories[i],
            }
            for i in range(n_wards)
        ],
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
