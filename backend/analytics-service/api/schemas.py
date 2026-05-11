from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class ScoreEntry(BaseModel):
    student_id: Optional[str] = None
    score: float
    subject: Optional[str] = None


class StudentScores(BaseModel):
    scores: List[float] = Field(..., description="List of student scores")
    student_id: Optional[str] = None


class ClassScores(BaseModel):
    students: List[StudentScores]
    subject: Optional[str] = None


class ZScoreRequest(BaseModel):
    scores: List[float]
    student_id: Optional[str] = None


class HistogramRequest(BaseModel):
    scores: List[float]
    bins: int = 10


class TrendRequest(BaseModel):
    data_points: List[float] = Field(..., description="Ordered list of scores over time")
    labels: Optional[List[str]] = None


class SubjectCorrelationRequest(BaseModel):
    subject_scores: dict[str, List[float]] = Field(
        ..., description="Dict of subject_name -> scores list"
    )


class AttendanceCorrelationRequest(BaseModel):
    attendance_rates: List[float]
    scores: List[float]


class RiskPredictionRequest(BaseModel):
    features: List[dict] = Field(
        ...,
        description="List of student feature dicts. Each dict must have 'scores' list and optional 'attendance_rate'",
    )


class DropoutPredictionRequest(BaseModel):
    historical_gpas: List[float]
    attendance_rates: List[float]
    current_scores: List[float]


class CompetencyDiagnosisRequest(BaseModel):
    competency_scores: dict[str, float] = Field(
        ..., description="Dict of competency_name -> score (0-100)"
    )


class WeaknessAnalysisRequest(BaseModel):
    subject_scores: dict[str, float] = Field(
        ..., description="Dict of subject_name -> score (0-100)"
    )


class RecommendationRequest(BaseModel):
    subject_scores: dict[str, float]
    strengths: Optional[List[str]] = None
    weaknesses: Optional[List[str]] = None


class BenchmarkingRequest(BaseModel):
    school_scores: List[float]
    national_scores: List[float]


class ItemAnalysisRequest(BaseModel):
    responses: List[List[int]] = Field(
        ...,
        description="Matrix of student responses: rows=students, cols=questions, 1=correct, 0=incorrect",
    )
    total_scores: Optional[List[float]] = None


class ReliabilityRequest(BaseModel):
    responses: List[List[int]] = Field(
        ...,
        description="Matrix of student responses: rows=students, cols=questions, 1=correct, 0=incorrect",
    )


class ClusterAnalysisRequest(BaseModel):
    subject_scores: dict[str, List[float]]


# ===== Response Models =====


class DescriptiveStatsResponse(BaseModel):
    count: int
    mean: float
    median: float
    mode: float
    std_dev: float
    variance: float
    min: float
    max: float
    q1: float
    q3: float
    iqr: float
    skewness: float
    kurtosis: float


class PercentileResponse(BaseModel):
    percentiles: dict[int, float]
    student_percentile: Optional[float] = None


class ZScoreResponse(BaseModel):
    z_scores: List[float]
    mean: float
    std_dev: float
    outliers: List[dict]


class HistogramResponse(BaseModel):
    bins: List[float]
    counts: List[int]
    bin_edges: List[float]


class TrendResponse(BaseModel):
    slope: float
    intercept: float
    r_squared: float
    predicted_next: Optional[float] = None
    direction: str
    values: List[float]
    trend_line: List[float]


class SubjectCorrelationResponse(BaseModel):
    correlations: dict[str, dict[str, float]]
    method: str


class AttendanceCorrelationResponse(BaseModel):
    pearson_r: float
    spearman_rho: float
    p_value: float
    interpretation: str


class RiskPredictionResponse(BaseModel):
    predictions: List[dict]
    accuracy: Optional[float] = None


class DropoutPredictionResponse(BaseModel):
    dropout_probability: float
    risk_level: str


class CompetencyDiagnosisResponse(BaseModel):
    overall_score: float
    strengths: List[dict]
    weaknesses: List[dict]
    recommendations: List[str]


class WeaknessAnalysisResponse(BaseModel):
    overall_average: float
    weaknesses: List[dict]
    strengths: List[dict]
    needs_intervention: bool


class RecommendationResponse(BaseModel):
    recommendations: List[str]
    priority_areas: List[str]


class BenchmarkingResponse(BaseModel):
    school_mean: float
    national_mean: float
    difference: float
    z_score: float
    percentile_rank: float
    above_national: bool
    significance: str


class ItemAnalysisResponse(BaseModel):
    item_difficulties: List[float]
    item_discriminations: List[float]
    point_biserial: List[float]
    avg_score: float
    reliability_alpha: float


class ClusterAnalysisResponse(BaseModel):
    clusters: List[dict]
    method: str
    silhouette_score: float
