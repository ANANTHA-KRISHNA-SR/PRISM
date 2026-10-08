from __future__ import annotations
import asyncio
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import ChatRequest, ChatResponse, CareerPrediction, PredictionRequest, PredictionResponse
from sarash_engine import SarashEngine
from market import MarketIntelligence
from llm import PrismLLM

app = FastAPI(title="PRISM + SARASH Local API", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

sarash = SarashEngine()
market = MarketIntelligence(sarash)
llm = PrismLLM()

@app.get("/health")
def health():
    return {
        "ok": True,
        "model": "SARASH",
        "supported_careers": sarash.supported_careers(),
        "live_adzuna_configured": bool(market.app_id and market.app_key),
        "llm_configured": bool(llm.key),
        "demo_mode": llm.demo_mode,
    }

async def build_predictions(req: PredictionRequest):
    choices = req.choices or [
        {"career": "AI/ML Engineer", "rank": 1, "preference": 90},
        {"career": "Data Scientist", "rank": 2, "preference": 80},
        {"career": "Software Engineer", "rank": 3, "preference": 75},
    ]

    choices = [
        c.model_dump() if hasattr(c, "model_dump") else c
        for c in choices
    ]

    # Keep first 3 unique SARASH careers.
    # This does not modify the existing PRISM career data.
    unique_choices = []
    seen_careers = set()

    for choice in choices:
        canonical_career = sarash._closest_career(
            str(choice.get("career", ""))
        )

        if canonical_career in seen_careers:
            continue

        seen_careers.add(canonical_career)

        clean_choice = dict(choice)
        clean_choice["career"] = canonical_career

        unique_choices.append(clean_choice)

        if len(unique_choices) == 3:
            break

    choices = unique_choices

    markets = await asyncio.gather(
        *[
            market.for_career(c["career"], req.location)
            for c in choices
        ]
    )

    predictions = []

    for choice, m in zip(choices, markets):
        p = sarash.predict(
            req.student.model_dump(),
            req.parent.model_dump(),
            choice,
            m,
        )

        predictions.append(
            CareerPrediction(
                career=p["career"],
                rank=p["rank"],
                match_score=p["match_score"],
                conflict_index=p["conflict_index"],
                parent_feasibility=p["parent_feasibility"],
                market_score=p["market_score"],
                sarash_score=p["sarash_score"],
                market_sources=m["sources"],
            )
        )

    predictions.sort(
        key=lambda x: x.sarash_score,
        reverse=True
    )

    return predictions, markets

@app.post("/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest):
    predictions, markets = await build_predictions(req)
    return PredictionResponse(
        predictions=predictions,
        used_live_adzuna=any(m.get("used_live_adzuna") for m in markets),
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    predictions, markets = await build_predictions(req)
    lines = []
    for i, p in enumerate(predictions, 1):
        lines.append(
            f"#{i} {p.career}: SARASH {p.sarash_score}/100; Match {p.match_score}/100; "
            f"Parent feasibility {p.parent_feasibility}/100 (Conflict {p.conflict_index}/100); "
            f"Market {p.market_score}/100."
        )
        src_names = [s.get("source", "unknown") for s in p.market_sources]
        lines.append("Market sources: " + ", ".join(dict.fromkeys(src_names)))
    context = "\n".join(lines)
    answer = llm.answer(req.message, context, [h.model_dump() for h in req.history])
    return ChatResponse(
        answer=answer,
        predictions=predictions,
        used_live_adzuna=any(m.get("used_live_adzuna") for m in markets),
    )
