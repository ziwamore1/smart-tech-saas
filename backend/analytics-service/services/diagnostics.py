import numpy as np
from typing import List, Dict


def analyze_competency_scores(competency_scores: Dict[str, float]) -> dict:
    if not competency_scores:
        return {
            "overall_score": 0.0,
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
        }

    scores_arr = np.array(list(competency_scores.values()), dtype=float)
    overall = float(np.mean(scores_arr))

    threshold = float(np.percentile(scores_arr, 30))
    high_threshold = float(np.percentile(scores_arr, 70))

    strengths = []
    weaknesses = []

    for area, score in competency_scores.items():
        entry = {
            "area": area,
            "score": round(score, 2),
            "percentage": round(score, 1),
        }
        if score >= high_threshold:
            entry["level"] = "proficient"
            strengths.append(entry)
        elif score <= threshold:
            entry["level"] = "needs_improvement"
            weaknesses.append(entry)
        else:
            entry["level"] = "developing"

    strengths.sort(key=lambda x: x["score"], reverse=True)
    weaknesses.sort(key=lambda x: x["score"])

    recommendations = []
    for w in weaknesses[:3]:
        recommendations.append(
            f"Focus on improving {w['area']} (current: {w['percentage']}%)"
        )

    if overall < 50:
        recommendations.append("Comprehensive intervention recommended across multiple areas")
    if strengths:
        strongest = strengths[0]
        recommendations.append(
            f"Leverage strength in {strongest['area']} to build confidence and cross-apply skills"
        )

    return {
        "overall_score": round(overall, 2),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
    }


def analyze_weaknesses(subject_scores: Dict[str, float]) -> dict:
    if not subject_scores:
        return {
            "overall_average": 0.0,
            "weaknesses": [],
            "strengths": [],
            "needs_intervention": False,
        }

    scores_arr = np.array(list(subject_scores.values()), dtype=float)
    overall = float(np.mean(scores_arr))

    mean_score = float(np.mean(scores_arr))
    std_dev = float(np.std(scores_arr, ddof=1)) if len(scores_arr) > 1 else 15.0

    weaknesses = []
    strengths = []

    for subject, score in subject_scores.items():
        deviation = score - mean_score
        z_score = deviation / std_dev if std_dev > 0 else 0

        entry = {
            "subject": subject,
            "score": round(score, 2),
            "deviation_from_mean": round(deviation, 2),
            "z_score": round(float(z_score), 4),
        }

        if score < 40:
            entry["severity"] = "critical"
            entry["description"] = f"Critical weakness in {subject}"
            weaknesses.append(entry)
        elif score < 50:
            entry["severity"] = "significant"
            entry["description"] = f"Significant weakness in {subject}"
            weaknesses.append(entry)
        elif z_score < -1:
            entry["severity"] = "relative"
            entry["description"] = f"Below average performance in {subject}"
            weaknesses.append(entry)
        elif score >= 70 or z_score > 1:
            entry["severity"] = "strength"
            strengths.append(entry)

    weaknesses.sort(key=lambda x: x["score"])
    strengths.sort(key=lambda x: x["score"], reverse=True)

    needs_intervention = any(w["severity"] in ("critical", "significant") for w in weaknesses)

    return {
        "overall_average": round(overall, 2),
        "weaknesses": weaknesses,
        "strengths": strengths,
        "needs_intervention": needs_intervention,
    }


def compute_competency_heatmap(
    student_competencies: Dict[str, Dict[str, float]]
) -> dict:
    students = list(student_competencies.keys())
    if not students:
        return {"students": [], "competencies": [], "matrix": []}

    all_competencies = set()
    for data in student_competencies.values():
        all_competencies.update(data.keys())
    competencies = sorted(all_competencies)

    matrix = []
    student_labels = []
    for student in students:
        row = []
        for comp in competencies:
            row.append(student_competencies[student].get(comp, 0))
        matrix.append(row)
        student_labels.append(student)

    return {
        "students": student_labels,
        "competencies": competencies,
        "matrix": [[round(float(v), 2) for v in row] for row in matrix],
    }


def cross_subject_diagnosis(subject_scores: Dict[str, float]) -> dict:
    if not subject_scores:
        return {"patterns": [], "overall_assessment": "No data available"}

    scores_arr = np.array(list(subject_scores.values()), dtype=float)
    overall = float(np.mean(scores_arr))
    std = float(np.std(scores_arr, ddof=1)) if len(scores_arr) > 1 else 0

    categories = {
        "stem": ["mathematics", "science", "physics", "chemistry", "biology", "ict", "computer"],
        "humanities": ["history", "geography", "religious", "social", "civic"],
        "languages": ["english", "literature", "language", "french", "swahili"],
        "vocational": ["business", "accounting", "commerce", "agriculture", "food", "design", "art", "music"],
    }

    pattern_scores = {}
    for category, keywords in categories.items():
        cat_scores = [
            score for subject, score in subject_scores.items()
            if any(kw in subject.lower() for kw in keywords)
        ]
        if cat_scores:
            pattern_scores[category] = float(np.mean(cat_scores))

    patterns = []
    for category, avg in pattern_scores.items():
        deviation = avg - overall
        patterns.append({
            "category": category,
            "average": round(avg, 2),
            "deviation_from_overall": round(deviation, 2),
            "status": "strength" if deviation > 5 else ("weakness" if deviation < -5 else "average"),
        })

    patterns.sort(key=lambda x: x["deviation_from_overall"], reverse=True)

    if overall >= 60:
        assessment = "Student is performing well overall"
    elif overall >= 40:
        assessment = "Student shows moderate performance with room for improvement"
    else:
        assessment = "Student requires significant academic support"

    if patterns:
        weakest = patterns[-1]
        strongest = patterns[0]
        if weakest["status"] == "weakness":
            assessment += f". Particular attention needed in {weakest['category']} subjects"

    return {
        "patterns": patterns,
        "overall_average": round(overall, 2),
        "consistency": "consistent" if std < 10 else ("variable" if std < 20 else "highly_variable"),
        "overall_assessment": assessment,
    }
