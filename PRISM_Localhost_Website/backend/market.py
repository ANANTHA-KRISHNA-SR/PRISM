from __future__ import annotations
import json
import math
import os
from pathlib import Path
from statistics import mean
from typing import Dict, List, Tuple

import httpx

BASE = Path(__file__).resolve().parent

class MarketIntelligence:
    """Combines SARASH seed data + permitted public snapshots + optional live Adzuna API data."""
    def __init__(self, sarash_engine):
        self.engine = sarash_engine
        self.snapshots = json.loads((BASE / "data" / "market_snapshots.json").read_text(encoding="utf-8"))
        self.app_id = os.getenv("ADZUNA_APP_ID", "").strip()
        self.app_key = os.getenv("ADZUNA_APP_KEY", "").strip()
        self.country = os.getenv("ADZUNA_COUNTRY", "in").strip() or "in"

    def _base(self, career: str) -> Dict:
        c = self.engine._closest_career(career)
        demand, growth, salary, resilience, geo, confidence = self.engine.market_seed[c]
        return {
            "demand": float(demand),
            "growth_yoy": float(growth),
            "salary_index": float(salary),
            "resilience": float(resilience),
            "geo_demand": float(geo),
            "confidence": float(confidence),
            "sources": [{"source": "SARASH market seed", "type": "prototype baseline"}],
            "used_live_adzuna": False,
        }

    def _apply_published_snapshots(self, career: str, location: str, signal: Dict) -> Dict:
        c = self.engine._closest_career(career)
        growth_values = [signal["growth_yoy"]]
        confidences = [0.45]

        naukri = self.snapshots.get("naukri", {})
        ns = naukri.get("signals", {}).get(c)
        if ns and "growth_yoy" in ns:
            growth_values.append(float(ns["growth_yoy"]))
            confidences.append(0.82)
            signal["sources"].append({
                "source": naukri.get("source_name"), "as_of": naukri.get("as_of"),
                "url": naukri.get("source_url"), "note": ns.get("note")
            })
        city = naukri.get("city_signals", {}).get(location)
        if city:
            # city signal nudges geographical demand; it is not treated as a career-specific growth number.
            signal["geo_demand"] = max(0, min(100, signal["geo_demand"] + float(city.get("overall_growth_yoy", 0)) * 0.5))

        foundit = self.snapshots.get("foundit", {})
        fs = foundit.get("signals", {}).get(c)
        if fs:
            if "growth_yoy" in fs:
                growth_values.append(float(fs["growth_yoy"]))
                confidences.append(0.78)
            if "qualitative_strength" in fs:
                signal["demand"] = 0.8 * signal["demand"] + 0.2 * (float(fs["qualitative_strength"]) * 100)
            signal["sources"].append({
                "source": foundit.get("source_name"), "as_of": foundit.get("as_of"),
                "url": foundit.get("source_url"), "note": fs.get("note")
            })

        # Reliability-weighted growth aggregation.
        if len(growth_values) > 1:
            signal["growth_yoy"] = sum(v*w for v, w in zip(growth_values, confidences)) / sum(confidences)
        signal["confidence"] = min(0.98, max(signal["confidence"], mean(confidences)))
        return signal

    async def _adzuna(self, career: str, location: str) -> Dict | None:
        if not self.app_id or not self.app_key:
            return None
        url = f"https://api.adzuna.com/v1/api/jobs/{self.country}/search/1"
        params = {
            "app_id": self.app_id,
            "app_key": self.app_key,
            "results_per_page": 50,
            "what": career,
            "where": location,
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                data = r.json()
            count = int(data.get("count", 0) or 0)
            salaries = []
            for job in data.get("results", []):
                lo, hi = job.get("salary_min"), job.get("salary_max")
                if lo and hi:
                    salaries.append((float(lo) + float(hi)) / 2)
                elif lo:
                    salaries.append(float(lo))
                elif hi:
                    salaries.append(float(hi))
            avg_salary = mean(salaries) if salaries else None
            return {"count": count, "avg_salary": avg_salary, "results_sampled": len(data.get("results", []))}
        except Exception:
            # A third-party outage must never take the PRISM demo down.
            return None

    async def for_career(self, career: str, location: str) -> Dict:
        signal = self._apply_published_snapshots(career, location, self._base(career))
        live = await self._adzuna(career, location)
        if live:
            # Smooth mappings keep live vacancy spikes from overpowering SARASH.
            live_demand = min(100.0, 38.0 + 13.0 * math.log10(live["count"] + 1))
            signal["demand"] = 0.55 * signal["demand"] + 0.45 * live_demand
            if live.get("avg_salary"):
                # Convert annual INR into a broad 0..100 salary strength. 20 LPA ~= 80.
                salary_lakh = float(live["avg_salary"]) / 100000.0
                live_salary_idx = max(15.0, min(100.0, salary_lakh * 4.0))
                signal["salary_index"] = 0.60 * signal["salary_index"] + 0.40 * live_salary_idx
            signal["confidence"] = min(0.99, signal["confidence"] + 0.08)
            signal["used_live_adzuna"] = True
            signal["sources"].append({
                "source": "Adzuna API",
                "type": "live job search",
                "vacancy_count": live["count"],
                "sampled_jobs": live["results_sampled"],
                "average_salary": live.get("avg_salary")
            })
        for k in ["demand", "salary_index", "resilience", "geo_demand"]:
            signal[k] = round(max(0.0, min(100.0, float(signal[k]))), 2)
        signal["growth_yoy"] = round(float(signal["growth_yoy"]), 2)
        signal["confidence"] = round(max(0.0, min(1.0, float(signal["confidence"]))), 3)
        return signal
