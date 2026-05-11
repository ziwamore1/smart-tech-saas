import numpy as np
from scipy import stats as scipy_stats
from typing import List


def compare_with_national(
    school_scores: List[float],
    national_scores: List[float],
) -> dict:
    if not school_scores or not national_scores:
        return {
            "school_mean": 0.0,
            "national_mean": 0.0,
            "difference": 0.0,
            "z_score": 0.0,
            "percentile_rank": 0.0,
            "above_national": False,
            "significance": "insufficient_data",
        }

    school_arr = np.array(school_scores, dtype=float)
    national_arr = np.array(national_scores, dtype=float)

    school_mean = float(np.mean(school_arr))
    national_mean = float(np.mean(national_arr))
    national_std = float(np.std(national_arr, ddof=1))

    difference = school_mean - national_mean

    if national_std > 0 and len(school_scores) > 1:
        z_score = difference / (national_std / np.sqrt(len(school_scores)))
    else:
        z_score = 0.0

    percentile_rank = float(scipy_stats.percentileofscore(national_scores, school_mean))

    if len(school_scores) >= 5 and len(national_scores) >= 5:
        _, p_value = scipy_stats.ttest_ind(school_arr, national_arr)
        significance = (
            "significant" if p_value < 0.05 else "not_significant"
        )
    else:
        significance = "insufficient_data"

    return {
        "school_mean": round(school_mean, 2),
        "national_mean": round(national_mean, 2),
        "difference": round(difference, 2),
        "z_score": round(float(z_score), 4),
        "percentile_rank": round(float(percentile_rank), 2),
        "above_national": difference > 0,
        "significance": significance,
    }


def compute_benchmark_trends(
    school_averages: List[float],
    national_averages: List[float],
    labels: List[str] = None,
) -> dict:
    if not school_averages or not national_averages:
        return {"points": [], "gap_trend": "insufficient_data"}

    points = []
    gaps = []

    for i in range(len(school_averages)):
        gap = school_averages[i] - national_averages[i]
        gaps.append(gap)
        points.append({
            "period": labels[i] if labels and i < len(labels) else f"Period {i + 1}",
            "school_average": round(school_averages[i], 2),
            "national_average": round(national_averages[i], 2),
            "gap": round(gap, 2),
        })

    if len(gaps) >= 2:
        first_half = float(np.mean(gaps[:len(gaps)//2]))
        second_half = float(np.mean(gaps[len(gaps)//2:]))

        if second_half > first_half + 1:
            gap_trend = "improving"
        elif second_half < first_half - 1:
            gap_trend = "widening"
        else:
            gap_trend = "stable"
    else:
        gap_trend = "insufficient_data"

    return {
        "points": points,
        "gap_trend": gap_trend,
        "overall_school_avg": round(float(np.mean(school_averages)), 2),
        "overall_national_avg": round(float(np.mean(national_averages)), 2),
    }


def compute_performance_gap(
    student_scores: List[float],
    target_scores: List[float],
) -> dict:
    if not student_scores or not target_scores:
        return {"mean_gap": 0.0, "max_gap": 0.0, "closing_trend": "unknown"}

    gaps = [
        target - actual
        for actual, target in zip(student_scores, target_scores)
    ]

    return {
        "mean_gap": round(float(np.mean(gaps)), 2),
        "max_gap": round(float(np.max(gaps)), 2),
        "min_gap": round(float(np.min(gaps)), 2),
        "students_below_target": sum(1 for g in gaps if g > 0),
        "total_students": len(gaps),
    }
