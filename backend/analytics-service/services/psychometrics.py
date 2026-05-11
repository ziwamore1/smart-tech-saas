import numpy as np
from scipy import stats as scipy_stats
from typing import List


def item_analysis(responses: List[List[int]], total_scores: List[float] = None) -> dict:
    if not responses or len(responses) < 2:
        return {
            "item_difficulties": [],
            "item_discriminations": [],
            "point_biserial": [],
            "avg_score": 0.0,
            "reliability_alpha": 0.0,
        }

    resp_arr = np.array(responses, dtype=float)
    n_students, n_items = resp_arr.shape

    difficulties = []
    discriminations = []
    point_biserials = []

    total = np.sum(resp_arr, axis=1) if total_scores is None else np.array(total_scores)

    for i in range(n_items):
        item = resp_arr[:, i]
        difficulty = float(np.mean(item))
        difficulties.append(round(difficulty, 4))

        if n_students >= 4:
            upper = np.percentile(total, 67)
            lower = np.percentile(total, 33)
            upper_group = item[total >= upper]
            lower_group = item[total <= lower]
            if len(upper_group) > 0 and len(lower_group) > 0:
                disc = float(np.mean(upper_group) - np.mean(lower_group))
            else:
                disc = 0.0
        else:
            disc = 0.0
        discriminations.append(round(disc, 4))

        if np.std(item) > 0 and np.std(total) > 0:
            pb, _ = scipy_stats.pointbiserialr(item, total)
        else:
            pb = 0.0
        point_biserials.append(round(float(pb), 4))

    avg_score = float(np.mean(total))

    reliability = cronbach_alpha(responses)

    return {
        "item_difficulties": difficulties,
        "item_discriminations": discriminations,
        "point_biserial": point_biserials,
        "avg_score": round(avg_score, 2),
        "reliability_alpha": reliability,
        "n_students": n_students,
        "n_items": n_items,
    }


def cronbach_alpha(responses: List[List[int]]) -> float:
    resp_arr = np.array(responses, dtype=float)
    n_students, n_items = resp_arr.shape

    if n_items < 2 or n_students < 2:
        return 0.0

    item_variances = np.var(resp_arr, axis=0, ddof=1)
    total_variance = np.var(np.sum(resp_arr, axis=1), ddof=1)

    if total_variance == 0:
        return 0.0

    alpha = (n_items / (n_items - 1)) * (1 - np.sum(item_variances) / total_variance)
    return round(float(alpha), 4)


def split_half_reliability(responses: List[List[int]]) -> dict:
    resp_arr = np.array(responses, dtype=float)
    n_students, n_items = resp_arr.shape

    if n_items < 4:
        return {"spearman_brown": 0.0, "guttman": 0.0}

    half1 = np.sum(resp_arr[:, ::2], axis=1)
    half2 = np.sum(resp_arr[:, 1::2], axis=1)

    if np.std(half1) == 0 or np.std(half2) == 0:
        return {"spearman_brown": 0.0, "guttman": 0.0}

    r, _ = scipy_stats.pearsonr(half1, half2)
    r = float(r)

    spearman_brown = (2 * r) / (1 + r)

    return {
        "spearman_brown": round(spearman_brown, 4),
        "split_half_r": round(r, 4),
    }


def difficulty_distribution(responses: List[List[int]], n_bins: int = 5) -> dict:
    resp_arr = np.array(responses, dtype=float)
    n_items = resp_arr.shape[1] if resp_arr.ndim > 1 else 0

    if n_items == 0:
        return {"bins": [], "counts": [], "labels": []}

    difficulties = [float(np.mean(resp_arr[:, i])) for i in range(n_items)]

    levels = {
        "very_easy": [d for d in difficulties if d >= 0.85],
        "easy": [d for d in difficulties if 0.65 <= d < 0.85],
        "moderate": [d for d in difficulties if 0.35 <= d < 0.65],
        "difficult": [d for d in difficulties if 0.15 <= d < 0.35],
        "very_difficult": [d for d in difficulties if d < 0.15],
    }

    return {
        "labels": list(levels.keys()),
        "counts": [len(v) for v in levels.values()],
        "percentages": [
            round(len(v) / max(n_items, 1) * 100, 1) for v in levels.values()
        ],
        "average_difficulty": round(float(np.mean(difficulties)), 4),
    }


def score_distribution_analysis(scores: List[float]) -> dict:
    if len(scores) < 2:
        return {
            "mean": 0.0, "median": 0.0, "std": 0.0,
            "skewness": 0.0, "kurtosis": 0.0, "distribution_type": "unknown",
        }

    arr = np.array(scores, dtype=float)
    mean = float(np.mean(arr))
    median = float(np.median(arr))
    std = float(np.std(arr, ddof=1))
    skew = float(scipy_stats.skew(arr))
    kurt = float(scipy_stats.kurtosis(arr, fisher=True))

    if abs(skew) < 0.5:
        skew_desc = "approximately_symmetric"
    elif skew > 0:
        skew_desc = "positively_skewed"
    else:
        skew_desc = "negatively_skewed"

    return {
        "mean": round(mean, 2),
        "median": round(median, 2),
        "std": round(std, 2),
        "skewness": round(skew, 4),
        "kurtosis": round(kurt, 4),
        "distribution_type": skew_desc,
        "range": [float(np.min(arr)), float(np.max(arr))],
    }
