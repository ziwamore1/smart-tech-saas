from typing import List, Dict


def generate_student_recommendations(
    subject_scores: Dict[str, float],
    strengths: List[str] = None,
    weaknesses: List[str] = None,
) -> dict:
    if not subject_scores:
        return {"recommendations": ["No data available"], "priority_areas": []}

    scored_items = list(subject_scores.items())
    scored_items.sort(key=lambda x: x[1])

    weakest = [s for s, score in scored_items if score < 40]
    below_average = [s for s, score in scored_items if 40 <= score < 50]
    strongest = [s for s, score in scored_items if score >= 70]

    recommendations = []
    priority_areas = []

    for subject in weakest:
        recommendations.append(
            f"Immediate intervention required for {subject}. Schedule remedial sessions and consider one-on-one tutoring."
        )
        priority_areas.append(subject)

    for subject in below_average:
        recommendations.append(
            f"Provide additional practice materials and targeted support in {subject}."
        )
        if subject not in priority_areas:
            priority_areas.append(subject)

    if weakest or below_average:
        recommendations.append(
            "Develop a structured study plan focusing on foundational concepts in weaker areas."
        )
        recommendations.append(
            "Schedule regular progress assessments to track improvement in identified weak areas."
        )

    for subject in strongest[:2]:
        recommendations.append(
            f"Encourage advanced work in {subject} — consider enrichment materials or peer tutoring roles."
        )

    if len(scored_items) >= 4:
        high = [s for s, _ in scored_items[-2:]]
        recommendations.append(
            f"Explore cross-curricular connections between strong areas ({', '.join(high[:2])}) and weaker subjects to build confidence."
        )

    if weaknesses:
        recommendations.append(
            f"Targeted intervention needed for: {', '.join(weaknesses[:3])}"
        )

    if strengths:
        recommendations.append(
            f"Leverage existing strengths in {', '.join(strengths[:2])} to support overall academic growth."
        )

    recommendations.append(
        "Maintain regular communication between teachers and parents to ensure consistent support."
    )

    return {
        "recommendations": recommendations,
        "priority_areas": priority_areas,
        "critical_count": len(weakest),
        "needs_intervention": len(weakest) > 0,
    }


def generate_class_intervention_needs(
    student_scores: Dict[str, Dict[str, float]],
    threshold: float = 40.0,
) -> dict:
    if not student_scores:
        return {"intervention_needs": [], "summary": "No data"}

    subject_fail_counts: Dict[str, int] = {}
    student_at_risk: List[dict] = []

    for student_id, scores in student_scores.items():
        fails = [subj for subj, score in scores.items() if score < threshold]
        if fails:
            student_at_risk.append({
                "student_id": student_id,
                "failing_subjects": fails,
                "fail_count": len(fails),
                "average": round(
                    sum(scores.values()) / len(scores), 2
                ) if scores else 0,
            })
            for subj in fails:
                subject_fail_counts[subj] = subject_fail_counts.get(subj, 0) + 1

    student_at_risk.sort(key=lambda x: x["fail_count"], reverse=True)

    subject_needs = [
        {
            "subject": subj,
            "failing_students": count,
            "percentage": round(count / max(len(student_scores), 1) * 100, 1),
        }
        for subj, count in sorted(
            subject_fail_counts.items(), key=lambda x: x[1], reverse=True
        )
    ]

    return {
        "intervention_needs": {
            "students_at_risk": student_at_risk,
            "subjects_needing_attention": subject_needs,
        },
        "summary": (
            f"{len(student_at_risk)} of {len(student_scores)} students need intervention. "
            f"Most critical subjects: {', '.join(s['subject'] for s in subject_needs[:3])}"
        ),
        "total_students": len(student_scores),
        "at_risk_count": len(student_at_risk),
    }


def suggest_interventions(
    score: float,
    subject: str,
    trend: str = "stable",
) -> List[str]:
    suggestions = []

    if score < 30:
        suggestions.extend([
            f"One-on-one tutoring sessions for {subject}",
            f"Modified curriculum and assessment approach for {subject}",
            f"Parent-teacher conference regarding {subject} performance",
            f"Referral to learning support services for {subject}",
        ])
    elif score < 50:
        suggestions.extend([
            f"Small group remediation in {subject}",
            f"Additional practice worksheets for {subject}",
            f"Peer tutoring program for {subject}",
            f"Regular progress monitoring in {subject}",
        ])
    elif score < 65:
        suggestions.append(
            f"Targeted support in specific {subject} topics"
        )

    if trend == "declining":
        suggestions.append(
            f"Investigate causes of declining performance in {subject}"
        )
        suggestions.append(
            f"Review study habits and engagement in {subject} class"
        )

    return suggestions
