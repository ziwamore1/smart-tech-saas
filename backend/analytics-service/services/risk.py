import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from typing import List


def compute_risk_scores(features: List[dict]) -> List[dict]:
    if len(features) < 2:
        return [{"student_id": f.get("student_id"), "risk_score": 0.5, "risk_level": "unknown"} for f in features]

    X = []
    for f in features:
        scores = f.get("scores", [])
        attendance = f.get("attendance_rate", 100)

        avg_score = float(np.mean(scores)) if scores else 0
        min_score = float(np.min(scores)) if scores else 0
        score_std = float(np.std(scores, ddof=1)) if len(scores) > 1 else 0
        below_pass = sum(1 for s in scores if s < 40) / max(len(scores), 1)

        X.append([avg_score, min_score, score_std, below_pass, attendance])

    X_arr = np.array(X, dtype=float)

    risk_scores = []
    for i, row in enumerate(X_arr):
        avg, mn, std, fail_rate, att = row

        risk = 0.0
        risk += max(0, (50 - avg) / 50) * 0.35
        risk += max(0, (50 - mn) / 50) * 0.15
        risk += fail_rate * 0.20
        risk += max(0, (90 - att) / 90) * 0.20
        if std > 15:
            risk += min(0.10, (std - 15) / 50)

        risk = min(1.0, max(0.0, risk))

        if risk >= 0.7:
            level = "high"
        elif risk >= 0.4:
            level = "moderate"
        else:
            level = "low"

        risk_scores.append({
            "student_id": features[i].get("student_id"),
            "risk_score": round(risk, 4),
            "risk_level": level,
            "contributors": {
                "academic_performance": round(max(0, (50 - avg) / 50) * 0.35, 4),
                "low_scores": round(max(0, (50 - mn) / 50) * 0.15, 4),
                "failure_rate": round(fail_rate * 0.20, 4),
                "attendance": round(max(0, (90 - att) / 90) * 0.20, 4),
                "inconsistency": round(min(0.10, (std - 15) / 50) if std > 15 else 0, 4),
            },
        })

    return risk_scores


def compute_dropout_probability(
    historical_gpas: List[float],
    attendance_rates: List[float],
    current_scores: List[float],
) -> dict:
    if not current_scores:
        return {"dropout_probability": 0.0, "risk_level": "unknown"}

    current_avg = float(np.mean(current_scores))
    score_trend = 0.0
    if len(historical_gpas) >= 2:
        score_trend = historical_gpas[-1] - historical_gpas[0]

    avg_attendance = float(np.mean(attendance_rates)) if attendance_rates else 100

    prob = 0.0
    prob += max(0, (40 - current_avg) / 40) * 0.30
    prob += max(0, -score_trend / 20) * 0.25
    prob += max(0, (85 - avg_attendance) / 85) * 0.25
    if current_avg < 30:
        prob += 0.20

    prob = min(1.0, max(0.0, prob))

    if prob >= 0.6:
        level = "high"
    elif prob >= 0.3:
        level = "moderate"
    else:
        level = "low"

    return {
        "dropout_probability": round(prob, 4),
        "risk_level": level,
    }


def compute_performance_trend(scores: List[float]) -> dict:
    if len(scores) < 2:
        return {"trend": "insufficient_data", "change_rate": 0.0}

    x = np.arange(len(scores))
    y = np.array(scores, dtype=float)

    A = np.vstack([x, np.ones(len(x))]).T
    slope, intercept = np.linalg.lstsq(A, y, rcond=None)[0]

    change_rate = float(slope)

    if change_rate > 1:
        trend = "improving"
    elif change_rate < -1:
        trend = "declining"
    else:
        trend = "stable"

    return {
        "trend": trend,
        "change_rate": round(change_rate, 4),
        "slope": round(float(slope), 6),
        "intercept": round(float(intercept), 4),
        "current_level": float(y[-1]),
        "predicted_next": round(float(slope * len(scores) + intercept), 2),
    }
