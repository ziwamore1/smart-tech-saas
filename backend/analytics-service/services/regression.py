import numpy as np
from scipy import stats as scipy_stats
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import StandardScaler
from typing import List, Optional


def fit_linear_regression(x: List[float], y: List[float]) -> dict:
    if len(x) < 2 or len(y) < 2:
        return {
            "slope": 0.0, "intercept": 0.0, "r_squared": 0.0,
            "p_value": 1.0, "std_err": 0.0,
        }

    x_arr = np.array(x, dtype=float).reshape(-1, 1)
    y_arr = np.array(y, dtype=float)

    model = LinearRegression()
    model.fit(x_arr, y_arr)

    slope = float(model.coef_[0])
    intercept = float(model.intercept_)
    r_squared = float(model.score(x_arr, y_arr))

    n = len(x)
    residuals = y_arr - model.predict(x_arr)
    std_err = float(np.sqrt(np.sum(residuals ** 2) / (n - 2))) if n > 2 else 0.0

    if n > 2 and abs(slope) > 1e-10:
        _, p_value = scipy_stats.pearsonr(x, y)
        p_value = float(p_value)
    else:
        p_value = 1.0

    trend_line = [float(model.predict(np.array([[v]]))[0]) for v in x]

    direction = "up" if slope > 0.01 else ("down" if slope < -0.01 else "stable")

    return {
        "slope": round(slope, 6),
        "intercept": round(intercept, 4),
        "r_squared": round(r_squared, 4),
        "p_value": round(p_value, 6),
        "std_err": round(std_err, 4),
        "direction": direction,
        "trend_line": [round(v, 4) for v in trend_line],
    }


def predict_next_value(x: List[float], y: List[float]) -> Optional[float]:
    if len(x) < 2:
        return None
    x_arr = np.array(x, dtype=float).reshape(-1, 1)
    model = LinearRegression()
    model.fit(x_arr, np.array(y, dtype=float))
    next_x = np.array([[len(x)]])
    return float(model.predict(next_x)[0])


def logistic_risk_prediction(
    features: List[List[float]], labels: List[int]
) -> dict:
    if len(set(labels)) < 2 or len(features) < 4:
        return {
            "coefficients": [],
            "intercept": 0.0,
            "accuracy": 0.0,
            "probabilities": [],
        }

    X = np.array(features, dtype=float)
    y = np.array(labels, dtype=int)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_scaled, y)

    probs = model.predict_proba(X_scaled)[:, 1]
    predictions = model.predict(X_scaled)
    accuracy = float(np.mean(predictions == y))

    return {
        "coefficients": [round(float(c), 4) for c in model.coef_[0]],
        "intercept": round(float(model.intercept_[0]), 4),
        "accuracy": round(accuracy, 4),
        "probabilities": [round(float(p), 4) for p in probs],
    }


def predict_risk(features: List[List[float]]) -> List[float]:
    X = np.array(features, dtype=float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_scaled, np.zeros(len(features)))

    probs = model.predict_proba(X_scaled)[:, 1]
    return [round(float(p), 4) for p in probs]
