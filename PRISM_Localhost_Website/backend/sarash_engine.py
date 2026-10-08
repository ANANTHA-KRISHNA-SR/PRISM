from __future__ import annotations

import math

from pathlib import Path

from typing import Dict, Iterable, List



import joblib

import numpy as np

import torch

from torch import nn



BASE = Path(__file__).resolve().parent



class SarashNet(nn.Module):

    def __init__(self, input_dim: int):

        super().__init__()

        self.shared = nn.Sequential(

            nn.Linear(input_dim, 64),

            nn.ReLU(),

            nn.BatchNorm1d(64),

            nn.Dropout(0.10),

            nn.Linear(64, 32),

            nn.ReLU(),

            nn.Linear(32, 16),

            nn.ReLU(),

        )

        self.match_head = nn.Sequential(nn.Linear(16, 1), nn.Sigmoid())

        self.conflict_head = nn.Linear(16, 1)

        self.market_head = nn.Sequential(nn.Linear(16, 1), nn.Sigmoid())

        self.final_head = nn.Sequential(nn.Linear(16, 1), nn.Sigmoid())



    def forward(self, x: torch.Tensor):

        z = self.shared(x)

        return (

            self.match_head(z),

            self.conflict_head(z),

            self.market_head(z),

            self.final_head(z),

        )



class SarashEngine:

    def __init__(self):

        bundle = torch.load(BASE / "model" / "sarash_model.pt", map_location="cpu")

        self.feature_cols: List[str] = bundle["feature_cols"]

        self.dims: List[str] = bundle["dims"]

        self.career_profiles: Dict[str, List[float]] = bundle["career_profiles"]

        self.career_cost_lakh: Dict[str, float] = bundle["career_cost_lakh"]

        # Expected education/training duration in years.

        # career_cost_lakh contains approximate TOTAL pathway cost,

        # while the parent budget supplied by PRISM is ANNUAL.

        # These durations allow SARASH to compare annual cost with annual budget.

        self.career_duration_years: Dict[str, float] = {

            "AI/ML Engineer": 4.0,

            "Data Scientist": 4.0,

            "Software Engineer": 4.0,

            "Cybersecurity Analyst": 4.0,

            "Cloud/DevOps Engineer": 4.0,

            "Mechanical Engineer": 4.0,

            "Aeronautical Engineer": 4.0,

            "Commercial Pilot": 2.0,

            "Defense Entry": 1.0,

            "UX/Product Designer": 4.0,

        }

        self.market_seed: Dict[str, List[float]] = bundle["market_seed"]

        self.model = SarashNet(bundle["input_dim"])

        self.model.load_state_dict(bundle["state_dict"])

        self.model.eval()

        self.scaler = joblib.load(BASE / "model" / "sarash_scaler.joblib")



    @staticmethod

    def _cosine(a: Iterable[float], b: Iterable[float]) -> float:

        a = np.asarray(list(a), dtype=float)

        b = np.asarray(list(b), dtype=float)

        denom = (np.linalg.norm(a) * np.linalg.norm(b))

        if denom == 0:

            return 0.0

        return float(np.dot(a, b) / denom)



    def supported_careers(self) -> List[str]:

        return list(self.career_profiles)



    def _closest_career(self, requested: str) -> str:

        requested_lower = requested.strip().lower()

        aliases = {

            "ai engineer": "AI/ML Engineer",

            "machine learning engineer": "AI/ML Engineer",

            "ml engineer": "AI/ML Engineer",

            "ai ml engineer": "AI/ML Engineer",

            "data science": "Data Scientist",

            "software developer": "Software Engineer",

            "developer": "Software Engineer",

            "cyber security": "Cybersecurity Analyst",

            "cybersecurity": "Cybersecurity Analyst",

            "devops": "Cloud/DevOps Engineer",

            "cloud engineer": "Cloud/DevOps Engineer",

            "mechanical": "Mechanical Engineer",

            "aeronautical": "Aeronautical Engineer",

            "pilot": "Commercial Pilot",

            "defence": "Defense Entry",

            "defense": "Defense Entry",

            "ux": "UX/Product Designer",

            "ui ux": "UX/Product Designer",

            "product designer": "UX/Product Designer"

        }

        if requested_lower in aliases:

            return aliases[requested_lower]

        for c in self.career_profiles:

            if requested_lower == c.lower() or requested_lower in c.lower():

                return c

        # Conservative fallback: keep the demo running while clearly using a known vector.

        return "Software Engineer"



    def predict(self, student: dict, parent: dict, choice: dict, market: dict) -> dict:

        career = self._closest_career(choice["career"])

        career_vector = self.career_profiles[career]



        student_vector = [

            float(student.get(dim, 50)) / 100.0

            for dim in self.dims

        ]



        cosine = self._cosine(student_vector, career_vector)



        budget = max(

            float(parent.get("budget_lakh", 10)),

            0.25

        )



        cost = float(self.career_cost_lakh[career])



        # ---------------------------------------------------------

        # ORIGINAL SARASH ML FEATURES

        # ---------------------------------------------------------



        features = {

            "choice_rank": int(choice.get("rank", 1)),



            "preference":

                float(choice.get("preference", 80)) / 100.0,



            **{

                f"student_{d}": student_vector[i]

                for i, d in enumerate(self.dims)

            },



            **{

                f"career_{d}": career_vector[i]

                for i, d in enumerate(self.dims)

            },



            "parent_budget_lakh": budget,



            "loan_willingness":

                float(parent.get("loan_willingness", 50)) / 100.0,



            "risk_tolerance":

                float(parent.get("risk_tolerance", 50)) / 100.0,



            "location_flexibility":

                float(parent.get("location_flexibility", 50)) / 100.0,



            "duration_tolerance":

                float(parent.get("duration_tolerance", 50)) / 100.0,



            "course_cost_lakh": cost,



            "market_demand":

                float(market["demand"]),



            "market_growth_yoy":

                float(market["growth_yoy"]),



            "salary_index":

                float(market["salary_index"]),



            "market_resilience":

                float(market["resilience"]),



            "geo_demand":

                float(market["geo_demand"]),



            "source_confidence":

                float(market["confidence"]),



            "cosine_feature": cosine,



            # Keep original feature for compatibility

            # with the existing trained scaler/model.

            "cost_budget_ratio": cost / budget,

        }



        row = np.array(

            [[features[c] for c in self.feature_cols]],

            dtype=np.float32

        )



        scaled = self.scaler.transform(

            row

        ).astype(np.float32)



        with torch.no_grad():

            match, conflict_logit, market_out, final = self.model(

                torch.tensor(scaled)

            )



        # ---------------------------------------------------------

        # RAW SARASH ML CONFLICT

        # ---------------------------------------------------------



        raw_conflict = float(

            torch.sigmoid(conflict_logit).item()

        )



        # ---------------------------------------------------------

        # CORRECT ANNUAL COST COMPARISON

        # ---------------------------------------------------------



        duration_years = max(

            float(

                self.career_duration_years.get(

                    career,

                    4.0

                )

            ),

            1.0

        )



        annual_course_cost = (

            cost / duration_years

        )



        annual_cost_budget_ratio = (

            annual_course_cost / budget

        )



        # ---------------------------------------------------------

        # NORMALIZE PARENT INPUTS

        # ---------------------------------------------------------



        loan = float(

            np.clip(

                float(

                    parent.get(

                        "loan_willingness",

                        50

                    )

                ) / 100.0,

                0.0,

                1.0

            )

        )



        risk = float(

            np.clip(

                float(

                    parent.get(

                        "risk_tolerance",

                        50

                    )

                ) / 100.0,

                0.0,

                1.0

            )

        )



        location = float(

            np.clip(

                float(

                    parent.get(

                        "location_flexibility",

                        50

                    )

                ) / 100.0,

                0.0,

                1.0

            )

        )



        duration_tolerance = float(

            np.clip(

                float(

                    parent.get(

                        "duration_tolerance",

                        50

                    )

                ) / 100.0,

                0.0,

                1.0

            )

        )



        # ---------------------------------------------------------

        # FINANCIAL CONFLICT

        # ---------------------------------------------------------



        affordability_conflict = float(

            np.clip(

                (

                    annual_cost_budget_ratio - 0.75

                ) / 1.25,

                0.0,

                1.0

            )

        )



        financial_conflict = (

            affordability_conflict

            * (1.0 - (0.35 * loan))

        )

        # ---------------------------------------------------------

        # CAREER-SPECIFIC CONFLICT PROFILE

        # ---------------------------------------------------------

        # Uses existing PRISM/SARASH market data only.

        # No career data or ML model data is changed.



        career_resilience = float(

            np.clip(

                float(market.get("resilience", 50)) / 100.0,

                0.0,

                1.0

            )

        )



        career_geo_demand = float(

            np.clip(

                float(market.get("geo_demand", 50)) / 100.0,

                0.0,

                1.0

            )

        )



        career_market_demand = float(

            np.clip(

                float(market.get("demand", 50)) / 100.0,

                0.0,

                1.0

            )

        )



        # A less resilient career creates more risk pressure,

        # especially when the parent has low risk tolerance.

        career_risk_conflict = (

            (1.0 - career_resilience)

            * (1.0 - risk)

        )



        # A career concentrated in fewer locations creates

        # more conflict when the family has low location flexibility.

        career_location_conflict = (

            (1.0 - career_geo_demand)

            * (1.0 - location)

        )



        # Lower current career demand adds a small career-specific

        # pressure without allowing market data to dominate.

        career_demand_conflict = (

            1.0 - career_market_demand

        )

        # ---------------------------------------------------------

        # EXPLAINABLE PARENT CONFLICT

        # ---------------------------------------------------------



        rule_conflict = (

            0.55 * financial_conflict

            + 0.10 * (1.0 - risk)

            + 0.07 * (1.0 - location)

            + 0.05 * (1.0 - duration_tolerance)

            + 0.10 * career_risk_conflict

            + 0.08 * career_location_conflict

            + 0.05 * career_demand_conflict

        )



        # ---------------------------------------------------------

        # SARASH ML CALIBRATION

        # ---------------------------------------------------------



        ml_adjustment = (

            raw_conflict - 0.5

        ) * 0.20



        calibrated_conflict = float(

            np.clip(

                rule_conflict + ml_adjustment,

                0.0,

                1.0

            )

        )



        # ---------------------------------------------------------

        # FINAL OUTPUT

        # ---------------------------------------------------------



        return {

            "career": career,



            "rank": int(

                choice.get("rank", 1)

            ),



            "match_score": round(

                float(match.item()) * 100,

                1

            ),



            "conflict_index": round(

                calibrated_conflict * 100,

                1

            ),



            "parent_feasibility": round(

                (1.0 - calibrated_conflict) * 100,

                1

            ),



            "market_score": round(

                float(market_out.item()) * 100,

                1

            ),



            "sarash_score": round(

                float(final.item()) * 100,

                1

            ),



            "cosine_similarity": round(

                cosine * 100,

                1

            ),



            "course_cost_lakh": cost,

        }