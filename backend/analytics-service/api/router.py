from fastapi import APIRouter, HTTPException
from api.schemas import (
    StudentScores, ZScoreRequest, HistogramRequest, TrendRequest,
    SubjectCorrelationRequest, AttendanceCorrelationRequest,
    RiskPredictionRequest, DropoutPredictionRequest,
    CompetencyDiagnosisRequest, WeaknessAnalysisRequest,
    RecommendationRequest, BenchmarkingRequest,
    ItemAnalysisRequest, ReliabilityRequest, ClusterAnalysisRequest,
    DescriptiveStatsResponse, PercentileResponse, ZScoreResponse,
    HistogramResponse, TrendResponse, SubjectCorrelationResponse,
    AttendanceCorrelationResponse, RiskPredictionResponse,
    DropoutPredictionResponse, CompetencyDiagnosisResponse,
    WeaknessAnalysisResponse, RecommendationResponse,
    BenchmarkingResponse, ItemAnalysisResponse, ClusterAnalysisResponse,
)
from services.statistics import (
    compute_descriptive_stats, compute_percentiles, compute_z_scores,
    compute_histogram, normal_cdf, detect_outliers_iqr,
)
from services.regression import (
    fit_linear_regression, predict_next_value,
    logistic_risk_prediction, predict_risk,
)
from services.correlation import (
    pearson_correlation, spearman_correlation,
    subject_correlation_matrix, cluster_subjects,
)
from services.risk import (
    compute_risk_scores, compute_dropout_probability,
    compute_performance_trend,
)
from services.diagnostics import (
    analyze_competency_scores, analyze_weaknesses,
    compute_competency_heatmap, cross_subject_diagnosis,
)
from services.recommendations import (
    generate_student_recommendations,
    generate_class_intervention_needs,
    suggest_interventions,
)
from services.benchmarking import (
    compare_with_national, compute_benchmark_trends,
    compute_performance_gap,
)
from services.psychometrics import (
    item_analysis, cronbach_alpha, split_half_reliability,
    difficulty_distribution, score_distribution_analysis,
)
from typing import List

router = APIRouter(prefix="/api/v2/analytics", tags=["analytics"])


# ── Descriptive Statistics ──

@router.post("/descriptive-stats", response_model=DescriptiveStatsResponse)
def descriptive_stats(req: StudentScores):
    return compute_descriptive_stats(req.scores)


@router.post("/percentiles", response_model=PercentileResponse)
def percentiles(req: ZScoreRequest):
    return compute_percentiles(req.scores, req.student_id)


@router.post("/z-scores", response_model=ZScoreResponse)
def z_scores(req: ZScoreRequest):
    return compute_z_scores(req.scores)


@router.post("/histogram", response_model=HistogramResponse)
def histogram(req: HistogramRequest):
    return compute_histogram(req.scores, req.bins)


@router.post("/outliers")
def outliers(req: StudentScores):
    return {"outliers": detect_outliers_iqr(req.scores)}


@router.post("/normal-cdf")
def normal_cdf_endpoint(mean: float = 0.0, std_dev: float = 1.0, x: float = 0.0):
    return {"probability": normal_cdf(x, mean, std_dev)}


# ── Trend Analysis ──

@router.post("/trends/linear")
def linear_trend(req: TrendRequest):
    x = list(range(len(req.data_points)))
    result = fit_linear_regression(x, req.data_points)
    predicted = predict_next_value(x, req.data_points)
    result["predicted_next"] = round(predicted, 2) if predicted is not None else None
    result["values"] = req.data_points
    return result


@router.post("/trends/performance")
def performance_trend(req: TrendRequest):
    return compute_performance_trend(req.data_points)


# ── Correlation Analysis ──

@router.post("/correlations/subjects", response_model=SubjectCorrelationResponse)
def subject_correlations(req: SubjectCorrelationRequest):
    return subject_correlation_matrix(req.subject_scores)


@router.post("/correlations/attendance", response_model=AttendanceCorrelationResponse)
def attendance_correlation(req: AttendanceCorrelationRequest):
    pearson = pearson_correlation(req.attendance_rates, req.scores)
    spearman = spearman_correlation(req.attendance_rates, req.scores)
    return {
        "pearson_r": pearson["r"],
        "spearman_rho": spearman["rho"],
        "p_value": pearson["p_value"],
        "interpretation": pearson["interpretation"],
    }


@router.post("/correlations/cluster", response_model=ClusterAnalysisResponse)
def subject_clusters(req: ClusterAnalysisRequest):
    return cluster_subjects(req.subject_scores)


# ── Predictive Analytics ──

@router.post("/predictive/risk", response_model=RiskPredictionResponse)
def risk_prediction(req: RiskPredictionRequest):
    scores = compute_risk_scores(req.features)
    return {"predictions": scores}


@router.post("/predictive/dropout", response_model=DropoutPredictionResponse)
def dropout_prediction(req: DropoutPredictionRequest):
    return compute_dropout_probability(
        req.historical_gpas, req.attendance_rates, req.current_scores
    )


# ── Diagnostic Analysis ──

@router.post("/diagnostic/competency", response_model=CompetencyDiagnosisResponse)
def competency_diagnosis(req: CompetencyDiagnosisRequest):
    return analyze_competency_scores(req.competency_scores)


@router.post("/diagnostic/weaknesses", response_model=WeaknessAnalysisResponse)
def weakness_analysis(req: WeaknessAnalysisRequest):
    return analyze_weaknesses(req.subject_scores)


@router.post("/diagnostic/cross-subject")
def cross_subject(req: WeaknessAnalysisRequest):
    return cross_subject_diagnosis(req.subject_scores)


# ── Recommendations ──

@router.post("/recommendations/student", response_model=RecommendationResponse)
def student_recommendations(req: RecommendationRequest):
    result = generate_student_recommendations(
        req.subject_scores, req.strengths, req.weaknesses
    )
    return {
        "recommendations": result["recommendations"],
        "priority_areas": result["priority_areas"],
    }


@router.post("/recommendations/suggest")
def intervention_suggestions(
    subject: str, score: float, trend: str = "stable"
):
    return {"suggestions": suggest_interventions(score, subject, trend)}


# ── Benchmarking ──

@router.post("/benchmarking/compare", response_model=BenchmarkingResponse)
def benchmarking_compare(req: BenchmarkingRequest):
    return compare_with_national(req.school_scores, req.national_scores)


@router.post("/benchmarking/trends")
def benchmarking_trends(
    school_averages: List[float],
    national_averages: List[float],
    labels: List[str] = None,
):
    return compute_benchmark_trends(school_averages, national_averages, labels)


# ── Psychometric Analysis ──

@router.post("/psychometric/item-analysis", response_model=ItemAnalysisResponse)
def psychometric_item_analysis(req: ItemAnalysisRequest):
    return item_analysis(req.responses, req.total_scores)


@router.post("/psychometric/reliability")
def psychometric_reliability(req: ReliabilityRequest):
    alpha = cronbach_alpha(req.responses)
    split = split_half_reliability(req.responses)
    return {
        "cronbach_alpha": alpha,
        "split_half": split,
        "interpretation": (
            "excellent" if alpha >= 0.9
            else "good" if alpha >= 0.8
            else "acceptable" if alpha >= 0.7
            else "questionable" if alpha >= 0.6
            else "poor"
        ),
    }


@router.post("/psychometric/difficulty-distribution")
def psychometric_difficulty(req: ItemAnalysisRequest):
    return difficulty_distribution(req.responses)


@router.post("/psychometric/score-distribution")
def psychometric_score_distribution(scores: List[float]):
    return score_distribution_analysis(scores)


# ── Health ──

@router.get("/health")
def health():
    return {
        "service": "smart-tech-analytics-service",
        "status": "running",
        "version": "2.0.0",
        "dependencies": {
            "numpy": "available",
            "scipy": "available",
            "scikit-learn": "available",
            "statsmodels": "available",
        },
    }
