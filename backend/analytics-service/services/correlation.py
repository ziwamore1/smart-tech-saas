import numpy as np
from scipy import stats as scipy_stats
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from typing import List, Dict


def pearson_correlation(x: List[float], y: List[float]) -> dict:
    if len(x) < 3 or len(y) < 3:
        return {"r": 0.0, "p_value": 1.0, "interpretation": "insufficient_data"}

    r, p = scipy_stats.pearsonr(x, y)
    r = float(r)
    p = float(p)

    abs_r = abs(r)
    if abs_r >= 0.8:
        strength = "very_strong"
    elif abs_r >= 0.6:
        strength = "strong"
    elif abs_r >= 0.4:
        strength = "moderate"
    elif abs_r >= 0.2:
        strength = "weak"
    else:
        strength = "very_weak"

    direction = "positive" if r > 0 else "negative"

    return {
        "r": round(r, 4),
        "r_squared": round(r ** 2, 4),
        "p_value": round(p, 6),
        "strength": strength,
        "direction": direction,
        "significant": p < 0.05,
        "interpretation": f"{strength}_{direction}_correlation",
    }


def spearman_correlation(x: List[float], y: List[float]) -> dict:
    if len(x) < 3 or len(y) < 3:
        return {"rho": 0.0, "p_value": 1.0, "interpretation": "insufficient_data"}

    rho, p = scipy_stats.spearmanr(x, y)
    rho = float(rho)
    p = float(p)

    abs_rho = abs(rho)
    if abs_rho >= 0.8:
        strength = "very_strong"
    elif abs_rho >= 0.6:
        strength = "strong"
    elif abs_rho >= 0.4:
        strength = "moderate"
    elif abs_rho >= 0.2:
        strength = "weak"
    else:
        strength = "very_weak"

    return {
        "rho": round(rho, 4),
        "p_value": round(p, 6),
        "strength": strength,
        "significant": p < 0.05,
        "interpretation": f"{strength}_monotonic_relationship",
    }


def subject_correlation_matrix(
    subject_scores: Dict[str, List[float]]
) -> dict:
    subjects = list(subject_scores.keys())
    matrix = {}

    for i, subj1 in enumerate(subjects):
        matrix[subj1] = {}
        for j, subj2 in enumerate(subjects):
            if i == j:
                matrix[subj1][subj2] = 1.0
            else:
                scores1 = subject_scores[subj1]
                scores2 = subject_scores[subj2]
                if len(scores1) >= 3 and len(scores2) >= 3:
                    r, p = scipy_stats.pearsonr(scores1, scores2)
                    matrix[subj1][subj2] = round(float(r), 4)
                else:
                    matrix[subj1][subj2] = 0.0

    return {
        "correlations": matrix,
        "method": "pearson",
        "subjects": subjects,
    }


def cluster_subjects(
    subject_scores: Dict[str, List[float]], n_clusters: int = None
) -> dict:
    subjects = list(subject_scores.keys())
    if len(subjects) < 2:
        return {"clusters": [], "method": "kmeans", "silhouette_score": 0.0}

    data_matrix = np.array([subject_scores[s] for s in subjects], dtype=float).T

    if data_matrix.shape[1] < 2:
        return {"clusters": [], "method": "kmeans", "silhouette_score": 0.0}

    if n_clusters is None:
        n_clusters = min(len(subjects), 3)
    n_clusters = max(2, min(n_clusters, len(subjects) - 1))

    if n_clusters < 2 or data_matrix.shape[0] < n_clusters:
        return {"clusters": [], "method": "kmeans", "silhouette_score": 0.0}

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(data_matrix)

    sil_score = float(silhouette_score(data_matrix, labels)) if len(set(labels)) > 1 else 0.0

    clusters = []
    for cluster_id in range(n_clusters):
        cluster_subjects = [
            subjects[i] for i in range(len(subjects)) if labels[i] == cluster_id
        ]
        centers = kmeans.cluster_centers_[cluster_id]
        clusters.append({
            "cluster_id": int(cluster_id),
            "subjects": cluster_subjects,
            "size": len(cluster_subjects),
            "center": [round(float(c), 4) for c in centers],
        })

    return {
        "clusters": clusters,
        "method": "kmeans",
        "silhouette_score": round(sil_score, 4),
        "n_clusters": n_clusters,
    }
