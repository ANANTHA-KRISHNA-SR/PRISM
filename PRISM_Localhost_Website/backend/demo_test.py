import asyncio
from dotenv import load_dotenv
load_dotenv()

from sarash_engine import SarashEngine
from market import MarketIntelligence

async def main():
    e = SarashEngine()
    m = MarketIntelligence(e)
    student = {"R":45,"I":94,"A":42,"S":50,"E":61,"C":72,"analytical":95,"quantitative":92,"creative":65,"communication":70,"spatial":58}
    parent = {"budget_lakh":10,"loan_willingness":65,"risk_tolerance":50,"location_flexibility":80,"duration_tolerance":75}
    choices = [
        {"career":"AI/ML Engineer","rank":1,"preference":95},
        {"career":"Data Scientist","rank":2,"preference":90},
        {"career":"Software Engineer","rank":3,"preference":80}
    ]
    for c in choices:
        market = await m.for_career(c["career"], "Chennai")
        pred = e.predict(student, parent, c, market)
        print(pred)
        print("sources:", [s.get("source") for s in market["sources"]])

if __name__ == "__main__":
    asyncio.run(main())
