import { Degree, degrees, questions } from './data'

export type Answers = Record<string, string | number | Record<string, number>>
export type FactorScores = {
  mathematics:number; logical_reasoning:number; technical_interest:number;
  creative_problem_solving:number; communication:number; leadership:number;
  R:number; I:number; A:number; S:number; E:number; C:number
}
export type DegreeResult = {
  degree: Degree
  studentFit:number
  familyFeasibility:number
  marketOpportunity:number
  prismScore:number
  conflictIndex:number
  careerInterestMatch:number
  budgetFit:number
  riskFit:number
  locationFit:number
  loanFit:number
  stabilityFit:number
}

const avg=(xs:number[])=> xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 50
const clamp=(n:number)=>Math.max(0,Math.min(100,n))
const ratingToScore=(n:number)=>({1:0,2:25,3:50,4:75,5:100}[n] ?? 50)

export function calculateFactors(answers: Answers): FactorScores {
  const byFactor: Record<string, number[]> = {}
  questions.slice(0,20).forEach(q=>{
    const raw=answers[q.id]
    if(raw===undefined) return
    let score=50

if(raw==='__TIMEOUT__'){
  score=0
}
else if(q.correct){
  score=String(raw)===q.correct ? 100 : 0
}
else {
  const op=q.options?.find(o=>o.value===String(raw))
  score=op?.score ?? 50
}
    ;(byFactor[q.factor] ||= []).push(score)
  })

  const riasec: Record<string, number[]> = {R:[],I:[],A:[],S:[],E:[],C:[]}
  questions.filter(q=>q.type==='riasec').forEach(q=>{
    const group=(answers[q.id] as Record<string,number>) || {}
    q.riasecItems?.forEach(item=>{
      if(group[item.code]) riasec[item.code].push(ratingToScore(Number(group[item.code])))
    })
  })

  return {
    mathematics: avg(byFactor.mathematics || []),
    logical_reasoning: avg(byFactor.logical_reasoning || []),
    technical_interest: avg(byFactor.technical_interest || []),
    creative_problem_solving: avg(byFactor.creative_problem_solving || []),
    communication: avg(byFactor.communication || []),
    leadership: avg(byFactor.leadership || []),
    R:avg(riasec.R), I:avg(riasec.I), A:avg(riasec.A), S:avg(riasec.S), E:avg(riasec.E), C:avg(riasec.C)
  }
}

export function cosine100(a:number[], b:number[]) {
  const dot=a.reduce((s,x,i)=>s+x*b[i],0)
  const na=Math.sqrt(a.reduce((s,x)=>s+x*x,0))
  const nb=Math.sqrt(b.reduce((s,x)=>s+x*x,0))
  return na && nb ? clamp((dot/(na*nb))*100) : 0
}

function familyFor(degree:Degree, answers:Answers){
  const budget=Number(answers.P01 ?? 3.75)
  const risk=ratingToScore(Number(answers.P02 ?? 3))
  const location=Number(answers.P03 ?? 50)
  const loan=ratingToScore(Number(answers.P04 ?? 3))
  const stability=ratingToScore(Number(answers.P05 ?? 3))
  const costMid=(degree.costLow+degree.costHigh)/2

  let budgetFit=100
  if(budget<degree.costLow) budgetFit=35
  else if(budget<costMid) budgetFit=65
  else if(budget<degree.costHigh) budgetFit=85
  if(budgetFit<80) budgetFit=clamp(budgetFit + loan*0.22)

  const careerRisk=degree.disruption
  const riskFit=clamp(100-Math.abs(risk-careerRisk))
  const locationFit=clamp(location + (degree.geography-70)*0.4)
  const loanFit=loan
  const marketStability=degree.resilience
  const stabilityFit=clamp(100-Math.abs(stability-marketStability))
  const family=0.35*budgetFit+0.15*riskFit+0.15*locationFit+0.15*loanFit+0.20*stabilityFit

  const financialConflict=100-budgetFit
  const locationConflict=100-locationFit
  const stabilityConflict=100-stabilityFit
  const riskConflict=100-riskFit
  const conflict=(financialConflict+locationConflict+stabilityConflict+riskConflict)/4

  return {family:clamp(family),conflict:clamp(conflict),budgetFit,riskFit,locationFit,loanFit,stabilityFit}
}

function marketFor(d:Degree){
  return clamp(0.30*d.demand + 0.20*d.growth + 0.15*d.salary + 0.15*d.geography + 0.10*d.economy + 0.10*d.resilience)
}

export function rankDegrees(answers:Answers, overrides:Record<string,Partial<Degree>>={}): {factors:FactorScores; results:DegreeResult[]} {
  const factors=calculateFactors(answers)
  const sv=[factors.R,factors.I,factors.A,factors.S,factors.E,factors.C]
  const results=degrees.map(base=>{
    const d={...base,...(overrides[base.id]||{})} as Degree
    const interest=cosine100(sv,d.riasec)
    const fs=[factors.mathematics,factors.logical_reasoning,factors.technical_interest,factors.creative_problem_solving,factors.communication,factors.leadership,interest]
    const studentFit=clamp(fs.reduce((s,x,i)=>s+x*d.weights[i],0)/100)
    const fam=familyFor(d,answers)
    const market=marketFor(d)
    const prism=clamp(0.40*studentFit+0.30*fam.family+0.30*market)
    return {degree:d,studentFit,familyFeasibility:fam.family,marketOpportunity:market,prismScore:prism,conflictIndex:fam.conflict,careerInterestMatch:interest,budgetFit:fam.budgetFit,riskFit:fam.riskFit,locationFit:fam.locationFit,loanFit:fam.loanFit,stabilityFit:fam.stabilityFit}
  }).sort((a,b)=>b.prismScore-a.prismScore)
  return {factors,results}
}

export function toSarashStudent(f:FactorScores){
  return {
    R:f.R,I:f.I,A:f.A,S:f.S,E:f.E,C:f.C,
    analytical:f.logical_reasoning,
    quantitative:f.mathematics,
    creative:f.creative_problem_solving,
    communication:f.communication,
    spatial:clamp((f.technical_interest+f.creative_problem_solving)/2)
  }
}

export function toSarashParent(answers:Answers){
  return {
    budget_lakh:Number(answers.P01 ?? 3.75),
    loan_willingness:ratingToScore(Number(answers.P04 ?? 3)),
    risk_tolerance:ratingToScore(Number(answers.P02 ?? 3)),
    location_flexibility:Number(answers.P03 ?? 50),
    duration_tolerance:75
  }
}
