import numpy as np
from scipy import stats as scipy_stats
from typing import List


def compute_descriptive_stats(scores: List[float]) -> dict:
    arr = np.array(scores, dtype=float)
    n = len(arr)
    if n == 0:
        return {
            "count": 0, "mean": 0, "median": 0, "mode": 0,
            "std_dev": 0, "variance": 0, "min": 0, "max": 0,
            "q1": 0, "q3": 0, "iqr": 0, "skewness": 0, "kurtosis": 0,
        }

    mean = float(np.mean(arr))
    median = float(np.median(arr))

    try:
        mode_result = scipy_stats.mode(arr, keepdims=True)
        mode_val = float(mode_result.mode[0]) if len(mode_result.mode) > 0 else median
    except Exception:
        mode_val = median

    std_dev = float(np.std(arr, ddof=1)) if n > 1 else 0.0
    variance = float(np.var(arr, ddof=1)) if n > 1 else 0.0
    min_val = float(np.min(arr))
    max_val = float(np.max(arr))
    q1 = float(np.percentile(arr, 25))
    q3 = float(np.percentile(arr, 75))
    iqr = q3 - q1
    skewness = float(scipy_stats.skew(arr)) if n > 2 else 0.0
    kurt = float(scipy_stats.kurtosis(arr, fisher=True)) if n > 2 else 0.0

    return {
        "count": n,
        "mean": round(mean, 4),
        "median": round(median, 4),
        "mode": round(mode_val, 4),
        "std_dev": round(std_dev, 4),
        "variance": round(variance, 4),
        "min": round(min_val, 4),
        "max": round(max_val, 4),
        "q1": round(q1, 4),
        "q3": round(q3, 4),
        "iqr": round(iqr, 4),
        "skewness": round(skewness, 4),
        "kurtosis": round(kurt, 4),
    }


def compute_percentiles(scores: List[float], student_score: float = None) -> dict:
    arr = np.array(scores, dtype=float)
    if len(arr) == 0:
        return {"percentiles": {}, "student_percentile": None}

    percentiles = {}
    for p in [5, 10, 25, 50, 75, 90, 95, 99]:
        percentiles[p] = round(float(np.percentile(arr, p)), 2)

    student_percentile = None
    if student_score is not None:
        student_percentile = round(
            float(scipy_stats.percentileofscore(arr, student_score)), 2
        )

    return {"percentiles": percentiles, "student_percentile": student_percentile}


def compute_z_scores(scores: List[float], student_id: str = None) -> dict:
    arr = np.array(scores, dtype=float)
    n = len(arr)
    if n < 2:
        return {"z_scores": [0.0] * n, "mean": 0.0, "std_dev": 0.0, "outliers": []}

    mean = float(np.mean(arr))
    std_dev = float(np.std(arr, ddof=1))
    z_scores = [round(float((x - mean) / std_dev), 4) for x in arr]

    outliers = []
    for i, (score, z) in enumerate(zip(scores, z_scores)):
        if abs(z) > 2:
            outliers.append({
                "index": i,
                "score": score,
                "z_score": z,
                "severity": "extreme" if abs(z) > 3 else "moderate",
            })

    return {
        "z_scores": z_scores,
        "mean": round(mean, 4),
        "std_dev": round(std_dev, 4),
        "outliers": outliers,
    }


def compute_histogram(scores: List[float], bins: int = 10) -> dict:
    arr = np.array(scores, dtype=float)
    if len(arr) == 0:
        return {"bins": [], "counts": [], "bin_edges": []}

    counts, bin_edges = np.histogram(arr, bins=bins)
    bin_centers = [(bin_edges[i] + bin_edges[i + 1]) / 2 for i in range(len(bin_edges) - 1)]

    return {
        "bins": [round(float(b), 2) for b in bin_centers],
        "counts": [int(c) for c in counts],
        "bin_edges": [round(float(e), 2) for e in bin_edges],
    }


def detect_outliers_iqr(scores: List[float]) -> List[dict]:
    arr = np.array(scores, dtype=float)
    if len(arr) < 4:
        return []

    q1 = float(np.percentile(arr, 25))
    q3 = float(np.percentile(arr, 75))
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    outliers = []
    for i, score in enumerate(scores):
        if score < lower or score > upper:
            outliers.append({
                "index": i,
                "score": score,
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2),
            })

    return outliers


def normal_cdf(x: float, mean: float = 0.0, std_dev: float = 1.0) -> float:
    return round(float(scipy_stats.norm.cdf(x, loc=mean, scale=std_dev)), 6)
