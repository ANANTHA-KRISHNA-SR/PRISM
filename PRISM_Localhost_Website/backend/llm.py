from __future__ import annotations
import os
from typing import List

SYSTEM = """You are PRISM AI Guide, the conversational explanation layer of the PRISM career platform.
You receive verified SARASH predictions and market evidence in the prompt.

Rules:
1. Use very simple, natural language. Avoid jargon unless you explain it in one short sentence.
2. Personalize answers using the student's SARASH results, parent feasibility and market evidence supplied to you.
3. Never invent, recalculate or change a SARASH score. Quote only supplied numbers.
4. Clearly distinguish: student fit, parent feasibility/conflict, and market conditions.
5. Do not say a career is guaranteed. Say it is a recommendation or current indication.
6. If the user writes in Tamil or Tamil-English, answer naturally in that style. Otherwise use simple English.
7. When market evidence is present, mention the source name only when it helps the user understand the answer.
8. If a requested live source was unavailable, be transparent and use the available snapshot/baseline instead.
9. Prefer concise answers: direct answer first, then 2-5 short bullets when useful.
10. For financial questions, do not present course costs or salary estimates as guaranteed; say they can vary by institution, employer and location.
"""

class PrismLLM:
    def __init__(self):
        self.demo_mode = os.getenv("PRISM_DEMO_MODE", "false").lower() == "true"
        self.key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = os.getenv("OPENAI_MODEL", "gpt-6-astra")
        self.client = None
        if self.key and not self.demo_mode:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.key)
            except ImportError:
                self.client = None

    def answer(self, message: str, context: str, history: List[dict]) -> str:
        if self.demo_mode or not self.client:
            return self._fallback(message, context)

        history_text = "\n".join(f"{h['role']}: {h['content']}" for h in history[-8:])
        prompt = f"""CURRENT PRISM/SARASH CONTEXT\n{context}\n\nRECENT CHAT\n{history_text}\n\nUSER\n{message}\n"""
        try:
            response = self.client.responses.create(
                model=self.model,
                instructions=SYSTEM,
                input=prompt,
                max_output_tokens=650,
            )
            return response.output_text.strip()
        except Exception:
            return self._fallback(message, context)

    @staticmethod
    def _fallback(message: str, context: str) -> str:
        # Keeps a hackathon demo functional if Wi-Fi or the LLM API fails.
        lower = message.lower()
        if "why" in lower or "recommend" in lower or "best" in lower:
            return "Based on your current SARASH results, the top option is the career with the strongest balance of student match, family feasibility, and market opportunity. " + context.split("\n")[0]
        if "conflict" in lower or "budget" in lower or "cost" in lower:
            return "SARASH checks whether the expected study cost fits your family budget, loan willingness, and risk level. A high Conflict Index means the pathway may need scholarships, financing, or a lower-cost alternative."
        if "market" in lower or "job" in lower or "salary" in lower:
            return "I am using the market signals currently available to PRISM. Live Adzuna data is used when API credentials are configured; Naukri and Foundit published hiring signals are used as supporting evidence. Salaries and vacancies can change."
        return "I can explain your SARASH score, compare your top careers, show why there is a parent-budget conflict, or explain the current job-market signal in simple language."
