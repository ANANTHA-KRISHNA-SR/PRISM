from typing import Dict, List, Literal
from pydantic import BaseModel, Field, field_validator

TRAITS = ["R", "I", "A", "S", "E", "C", "analytical", "quantitative", "creative", "communication", "spatial"]

class StudentProfile(BaseModel):
    R: float = 50; I: float = 50; A: float = 50; S: float = 50; E: float = 50; C: float = 50
    analytical: float = 50; quantitative: float = 50; creative: float = 50; communication: float = 50; spatial: float = 50

    @field_validator(*TRAITS)
    @classmethod
    def clamp_scores(cls, value: float) -> float:
        return max(0.0, min(100.0, float(value)))

class ParentProfile(BaseModel):
    budget_lakh: float = Field(ge=0, default=10)
    loan_willingness: float = Field(ge=0, le=100, default=50)
    risk_tolerance: float = Field(ge=0, le=100, default=50)
    location_flexibility: float = Field(ge=0, le=100, default=50)
    duration_tolerance: float = Field(ge=0, le=100, default=50)

class CareerChoice(BaseModel):
    career: str
    rank: int = Field(ge=1)
    preference: float = Field(ge=0, le=100, default=80)

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class PredictionRequest(BaseModel):
    student: StudentProfile = Field(default_factory=StudentProfile)
    parent: ParentProfile = Field(default_factory=ParentProfile)
    choices: List[CareerChoice] = Field(default_factory=list)
    location: str = "Chennai"

class CareerPrediction(BaseModel):
    career: str
    rank: int
    match_score: float
    conflict_index: float
    parent_feasibility: float
    market_score: float
    sarash_score: float
    market_sources: List[Dict]

class PredictionResponse(BaseModel):
    predictions: List[CareerPrediction]
    used_live_adzuna: bool
    model_name: str = "SARASH"
    prototype_notice: str = "SARASH is trained on synthetic labels and is not a scientifically validated guarantee of career outcomes."

class ChatRequest(PredictionRequest):
    message: str = Field(min_length=1, max_length=4000)
    history: List[ChatTurn] = Field(default_factory=list)

class ChatResponse(PredictionResponse):
    answer: str
