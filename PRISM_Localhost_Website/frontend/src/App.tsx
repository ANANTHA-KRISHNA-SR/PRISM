import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { degrees, questions, Degree } from './data'
import { Answers, DegreeResult, FactorScores, rankDegrees, toSarashParent, toSarashStudent } from './scoring'

type Page='welcome'|'dashboard'|'assessment'|'results'|'detail'|'profile'|'settings'|'privacy'|'help'|'admin'
type StudentInfo={name:string;dob:string;city:string;email:string}
type Prediction={career:string;rank:number;match_score:number;conflict_index:number;parent_feasibility:number;market_score:number;sarash_score:number;market_sources?:Record<string,unknown>[]}
type SavedApplicant={id:string;dobHash:string;student:StudentInfo;answers:Answers;createdAt:string}

const API=import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const ADMIN_PIN=import.meta.env.VITE_PRISM_ADMIN_PIN || ''

const fmt=(n:number)=>Math.round(n)
const uid=()=>`PRISM-26-${Math.random().toString(36).slice(2,8).toUpperCase()}`
const scoreLabel=(n:number)=>n>=85?'Excellent alignment':n>=70?'Strong alignment':n>=55?'Moderate alignment':'Developing alignment'
const conflictLabel=(n:number)=>n<=20?'Low':n<=40?'Mild':n<=60?'Moderate':n<=80?'High':'Very high'

async function sha256(value:string){
  const data=new TextEncoder().encode(value)
  const digest=await crypto.subtle.digest('SHA-256',data)
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function dobPassword(dob:string){ return dob.split('-').reverse().join('') }

function Icon({name,size=18}:{name:string,size?:number}){
  const paths:Record<string,ReactNode>={
    home:<><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    spark:<><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/></>,
    chart:<><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,
    user:<><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    help:<><circle cx="12" cy="12" r="9"/><path d="M9.8 9.2a2.4 2.4 0 1 1 3.2 2.3c-.8.3-1 .8-1 1.5"/><path d="M12 17h.01"/></>,
    moon:<><path d="M21 12.7A8.4 8.4 0 1 1 11.3 3 6.6 6.6 0 0 0 21 12.7Z"/></>,
    sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    download:<><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></>,
    lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    bot:<><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4"/><path d="M9 12h.01M15 12h.01"/><path d="M8 16h8"/></>,
    close:<><path d="m6 6 12 12M18 6 6 18"/></>,
    send:<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    mic:<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>,
    paperclip:<><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7L9.7 17.7a2 2 0 1 1-2.8-2.8l8.9-8.9"/></>,
    arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
    shield:<><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z"/><path d="m9 12 2 2 4-4"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    logout:<><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M18 12H9"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function ScoreRing({score,label,size='lg'}:{score:number,label:string,size?:'sm'|'lg'}){
  return <div className={`score-ring ${size}`} style={{'--score':`${score*3.6}deg`} as React.CSSProperties}>
    <div className="score-ring-inner"><strong>{fmt(score)}</strong><span>{label}</span></div>
  </div>
}

function RadarChart({items}:{items:{label:string;value:number}[]}){
  const size=320,c=160,r=112
  const pts=(scale:number)=>items.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length;return `${c+Math.cos(a)*r*scale},${c+Math.sin(a)*r*scale}`}).join(' ')
  const dataPts=items.map((it,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length;return `${c+Math.cos(a)*r*(it.value/100)},${c+Math.sin(a)*r*(it.value/100)}`}).join(' ')
  return <div className="radar-wrap"><svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="PRISM analysis radar chart">
    {[.25,.5,.75,1].map(x=><polygon key={x} points={pts(x)} className="radar-grid"/>) }
    {items.map((it,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length;const x=c+Math.cos(a)*r,y=c+Math.sin(a)*r;const lx=c+Math.cos(a)*(r+27),ly=c+Math.sin(a)*(r+27);return <g key={it.label}><line x1={c} y1={c} x2={x} y2={y} className="radar-axis"/><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="radar-label">{it.label}</text></g>})}
    <polygon points={dataPts} className="radar-data"/>
    {items.map((it,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length;return <circle key={it.label} cx={c+Math.cos(a)*r*(it.value/100)} cy={c+Math.sin(a)*r*(it.value/100)} r="4.5" className="radar-dot"><title>{it.label}: {fmt(it.value)}</title></circle>})}
  </svg></div>
}

function Confetti({show}:{show:boolean}){
  if(!show) return null
  return <div className="confetti-layer" aria-hidden="true">{Array.from({length:62}).map((_,i)=><i key={i} style={{'--x':`${(i*37)%100}%`,'--delay':`${(i%11)*.07}s`,'--rot':`${(i*71)%360}deg`,'--drift':`${((i%7)-3)*16}px`} as React.CSSProperties}/>)}</div>
}

function Modal({title,onClose,children}:{title:string,onClose:()=>void,children:ReactNode}){
  return <div className="modal-backdrop" onMouseDown={e=>e.currentTarget===e.target&&onClose()}><div className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><span className="eyebrow">SECURE ACCESS</span><h3>{title}</h3></div><button className="icon-btn" onClick={onClose}><Icon name="close"/></button></div>{children}</div></div>
}

function App(){
  const [theme,setTheme]=useState<'light'|'dark'>(()=>(localStorage.getItem('prism.theme') as 'light'|'dark')||'dark')
  const [page,setPage]=useState<Page>('welcome')
  const [student,setStudent]=useState<StudentInfo>({name:'',dob:'',city:'Chennai',email:''})
  const [answers,setAnswers]=useState<Answers>({})
  const [qIndex,setQIndex]=useState(0)
  const [applicantId,setApplicantId]=useState(localStorage.getItem('prism.currentApplicant')||'')
  const [loginOpen,setLoginOpen]=useState(false)
  const [adminLogin,setAdminLogin]=useState(false)
  const [adminAuthed,setAdminAuthed]=useState(sessionStorage.getItem('prism.admin')==='yes')
  const [selected,setSelected]=useState<DegreeResult|null>(null)
  const [predictions,setPredictions]=useState<Prediction[]>([])
  const [mlStatus,setMlStatus]=useState<'idle'|'loading'|'ok'|'offline'>('idle')
  const [showCelebrate,setShowCelebrate]=useState(false)
  const [degreeQuery,setDegreeQuery]=useState('')
  const [sort,setSort]=useState<'score'|'market'|'name'>('score')
  const [overrides,setOverrides]=useState<Record<string,Partial<Degree>>>(()=>JSON.parse(localStorage.getItem('prism.marketOverrides')||'{}'))
  const ranked=useMemo(()=>rankDegrees(answers,overrides),[answers,overrides])
  const hasResults=Object.keys(answers).length>=29 || !!localStorage.getItem('prism.lastComplete')

  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('prism.theme',theme)},[theme])
  useEffect(()=>{if(page==='results'&&ranked.results[0]?.prismScore>=85){setShowCelebrate(true);const t=setTimeout(()=>setShowCelebrate(false),4200);return()=>clearTimeout(t)}},[page,ranked.results])
  useEffect(() => {
  if (page === 'results') {
    void getMlPrediction()
  }
}, [page])
  async function persistApplicant(){
    let id=applicantId || uid()
    const pass=dobPassword(student.dob)
    const dobHash=await sha256(pass)
    const saved:SavedApplicant={id,dobHash,student,answers,createdAt:new Date().toISOString()}
    localStorage.setItem(`prism.applicant.${id}`,JSON.stringify(saved))
    localStorage.setItem('prism.currentApplicant',id)
    localStorage.setItem('prism.lastComplete','1')
    setApplicantId(id)
    return id
  }

  async function getMlPrediction(){
    setMlStatus('loading')
    const top=ranked.results.slice(0,10)
    const body={student:toSarashStudent(ranked.factors),parent:toSarashParent(answers),choices:top.map((r,i)=>({career:r.degree.career,rank:i+1,preference:Math.round(r.studentFit)})),location:student.city||'Chennai'}
    try{
      const res=await fetch(`${API}/predict`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!res.ok) throw new Error('predict failed')
      const data=await res.json();setPredictions(data.predictions||[]);setMlStatus('ok')
    }catch{setMlStatus('offline')}
  }

  async function completeAssessment(){
    await persistApplicant()
    setPage('results')
    void getMlPrediction()
  }

  function resetAssessment(){setAnswers({});setQIndex(0);setPredictions([]);setStudent(s=>({...s,name:'',dob:'',email:''}));setPage('assessment')}

  async function applicantLogin(id:string,dob:string){
    const item=localStorage.getItem(`prism.applicant.${id.trim().toUpperCase()}`)
    if(!item) return 'Applicant ID not found on this browser.'
    const saved:SavedApplicant=JSON.parse(item)
    const hash=await sha256(dob.replace(/\D/g,''))
    if(hash!==saved.dobHash) return 'Date-of-birth password does not match.'
    setStudent(saved.student);setAnswers(saved.answers);setApplicantId(saved.id);localStorage.setItem('prism.currentApplicant',saved.id);setLoginOpen(false);setPage('results');setTimeout(()=>void getMlPrediction(),30)
    return ''
  }

  function navTo(p:Page){ if(p==='results'&&!hasResults){setPage('assessment');return} setPage(p) }

  return <div className="app-shell">
    <Background theme={theme}/>
    {page!=='welcome'&&<Topbar theme={theme} setTheme={setTheme} page={page} navTo={navTo} onApplicant={()=>applicantId ? setPage('profile') : setLoginOpen(true)} onAdmin={()=>adminAuthed?setPage('admin'):setAdminLogin(true)} applicantId={applicantId}/>} 
    <main className={page==='welcome'?'main-welcome':'main-content'}>
      {page==='welcome'&&<Welcome onStart={()=>setPage('assessment')} onLogin={()=>setLoginOpen(true)} theme={theme} setTheme={setTheme}/>} 
      {page==='dashboard'&&<Dashboard student={student} ranked={ranked.results} applicantId={applicantId} onContinue={()=>setPage('assessment')} onResults={()=>setPage('results')} onDetail={r=>{setSelected(r);setPage('detail')}} degreeQuery={degreeQuery} setDegreeQuery={setDegreeQuery} sort={sort} setSort={setSort}/>} 
      {page==='assessment'&&<Assessment student={student} setStudent={setStudent} answers={answers} setAnswers={setAnswers} index={qIndex} setIndex={setQIndex} onComplete={completeAssessment}/>} 
      {page==='results'&&<Results student={student} applicantId={applicantId} factors={ranked.factors} results={ranked.results} predictions={predictions} mlStatus={mlStatus} onDetail={r=>{setSelected(r);setPage('detail')}} onRetake={resetAssessment}/>} 
      {page==='detail'&&selected&&<Detail result={selected} prediction={predictions.find(p=>p.career===selected.degree.career)} onBack={()=>setPage('results')}/>} 
      {page==='profile'&&<Profile student={student} applicantId={applicantId} factors={ranked.factors} hasResults={hasResults}/>} 
      {page==='settings'&&<Settings theme={theme} setTheme={setTheme}/>} 
      {page==='privacy'&&<Privacy/>}
      {page==='help'&&<Help/>}
      {page==='admin'&&adminAuthed&&<Admin overrides={overrides} setOverrides={o=>{setOverrides(o);localStorage.setItem('prism.marketOverrides',JSON.stringify(o))}} onLogout={()=>{sessionStorage.removeItem('prism.admin');setAdminAuthed(false);setPage('dashboard')}}/>}
    </main>
    {page!=='welcome'&&<MobileNav page={page} navTo={navTo}/>} 
    {page!=='welcome'&&<PrismChatbot factors={ranked.factors} answers={answers} results={ranked.results} student={student}/>} 
    <Confetti show={showCelebrate}/>
    {loginOpen&&<ApplicantLogin onClose={()=>setLoginOpen(false)} onLogin={applicantLogin}/>} 
    {adminLogin&&<AdminLogin onClose={()=>setAdminLogin(false)} onSuccess={()=>{setAdminAuthed(true);sessionStorage.setItem('prism.admin','yes');setAdminLogin(false);setPage('admin')}}/>}
  </div>
}

function Background({theme}:{theme:'light'|'dark'}){
  return <div className={`ambient ${theme}`} aria-hidden="true"><div className="ambient-grid"/><div className="orb orb-a"/><div className="orb orb-b"/><div className="scan-line"/></div>
}

function Topbar({theme,setTheme,page,navTo,onApplicant,onAdmin,applicantId}:{theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void;page:Page;navTo:(p:Page)=>void;onApplicant:()=>void;onAdmin:()=>void;applicantId:string}){
  const links:[Page,string][]=[['dashboard','Dashboard'],['assessment','Assessment'],['results','Results'],['help','Help']]
  return <header className="topbar"><button className="brand" onClick={()=>navTo('dashboard')}><span className="brand-mark"><span/></span><span><b>PRISM</b><small>Career Intelligence</small></span></button><nav className="desktop-nav">{links.map(([p,l])=><button key={p} className={page===p?'active':''} onClick={()=>navTo(p)}>{l}</button>)}</nav><div className="top-actions"><button className="icon-btn theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Toggle theme"><Icon name={theme==='dark'?'sun':'moon'}/></button><button className="compact-login" onClick={onApplicant}><Icon name="user" size={16}/><span>{applicantId?'Profile':'Applicant'}</span></button><button className="compact-login admin" onClick={onAdmin}><Icon name="lock" size={15}/><span>Admin</span></button></div></header>
}

function Welcome({onStart,onLogin,theme,setTheme}:{onStart:()=>void;onLogin:()=>void;theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void}){
  return <section className="welcome"><div className="welcome-top"><button className="brand large"><span className="brand-mark"><span/></span><span><b>PRISM</b><small>Career Intelligence</small></span></button><div className="welcome-actions"><button className="icon-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}><Icon name={theme==='dark'?'sun':'moon'}/></button><button className="ghost-btn" onClick={onLogin}>Returning applicant</button></div></div><div className="hero"><div className="hero-copy"><div className="status-pill"><i/> Explainable career intelligence · SARASH ML</div><h1>Find the path where <em>you</em>, your family and the market align.</h1><p>PRISM combines student strengths, RIASEC interests, family feasibility and dynamic market signals into transparent career recommendations—not a black-box “perfect career” claim.</p><div className="hero-actions"><button className="primary-btn xl" onClick={onStart}>Start my PRISM assessment <Icon name="arrow"/></button><button className="secondary-btn xl" onClick={onLogin}>I already have an ID</button></div><div className="trust-row"><span><Icon name="shield"/> Explainable scoring</span><span><Icon name="spark"/> SARASH ML layer</span><span><Icon name="chart"/> Visual analysis</span></div></div><div className="hero-visual"><div className="glass-window"><div className="window-head"><span>PRISM SIGNAL MAP</span><span className="live-dot">● LIVE DEMO</span></div><RadarChart items={[{label:'Fit',value:92},{label:'Family',value:78},{label:'Market',value:90},{label:'Logic',value:88},{label:'Interest',value:84},{label:'Skills',value:76}]}/><div className="mini-result"><div><small>Top alignment</small><b>AI & Data Science</b></div><strong>89</strong></div></div><div className="floating-card card-one"><small>Conflict index</small><b>18 · Low</b></div><div className="floating-card card-two"><small>Market signal</small><b>Strong ↑</b></div></div></div><div className="welcome-strip"><span>01 Student Fit</span><span>02 Family Feasibility</span><span>03 Market Opportunity</span><span>04 Explainable Result</span></div></section>
}

function Dashboard({student,ranked,applicantId,onContinue,onResults,onDetail,degreeQuery,setDegreeQuery,sort,setSort}:{student:StudentInfo;ranked:DegreeResult[];applicantId:string;onContinue:()=>void;onResults:()=>void;onDetail:(r:DegreeResult)=>void;degreeQuery:string;setDegreeQuery:(x:string)=>void;sort:'score'|'market'|'name';setSort:(x:'score'|'market'|'name')=>void}){
  const list=[...ranked].filter(r=>r.degree.name.toLowerCase().includes(degreeQuery.toLowerCase())).sort((a,b)=>sort==='market'?b.marketOpportunity-a.marketOpportunity:sort==='name'?a.degree.name.localeCompare(b.degree.name):b.prismScore-a.prismScore)
  return <div className="page"><section className="page-head"><div><span className="eyebrow">YOUR PRISM WORKSPACE</span><h1>{student.name?`Welcome back, ${student.name.split(' ')[0]}`:'Build your career signal'}</h1><p>{applicantId?<>Applicant ID <code>{applicantId}</code> · your latest assessment is available on this browser.</>:`Complete the assessment to unlock your ranked pathways, radar chart and SARASH ML prediction.`}</p></div><button className="primary-btn" onClick={applicantId?onResults:onContinue}>{applicantId?'Open my results':'Begin assessment'} <Icon name="arrow"/></button></section><div className="metric-grid"><Metric icon="spark" label="PRISM Score" value={applicantId?`${fmt(ranked[0]?.prismScore||0)}/100`:'—'} hint="Student + family + market"/><Metric icon="chart" label="Top pathway" value={applicantId?(ranked[0]?.degree.short||'—'):'Locked'} hint="Based on current inputs"/><Metric icon="shield" label="Conflict" value={applicantId?conflictLabel(ranked[0]?.conflictIndex||0):'—'} hint="Neutral alignment check"/><Metric icon="user" label="Applicant" value={applicantId?'Saved':'New'} hint={applicantId||'Create after completion'}/></div><section className="panel explorer"><div className="panel-head"><div><span className="eyebrow">DEGREE EXPLORER</span><h2>Configured PRISM pathways</h2></div><div className="filter-row"><label className="search-box"><Icon name="search"/><input value={degreeQuery} onChange={e=>setDegreeQuery(e.target.value)} placeholder="Search degree"/></label><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="score">Sort: PRISM score</option><option value="market">Sort: market</option><option value="name">Sort: name</option></select></div></div><div className="degree-table">{list.map((r,i)=><button className="degree-row" key={r.degree.id} onClick={()=>onDetail(r)}><span className="rank-num">{String(i+1).padStart(2,'0')}</span><span className="degree-main"><b>{r.degree.short}</b><small>{r.degree.name}</small></span><span className="row-stat"><small>Student fit</small><b>{fmt(r.studentFit)}</b></span><span className="row-stat"><small>Market</small><b>{fmt(r.marketOpportunity)}</b></span><span className="row-score"><b>{fmt(r.prismScore)}</b><span>/100</span></span><Icon name="arrow"/></button>)}</div></section></div>
}

function Metric({icon,label,value,hint}:{icon:string;label:string;value:string;hint:string}){return <div className="metric-card"><span className="metric-icon"><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div></div>}

function Assessment({student,setStudent,answers,setAnswers,index,setIndex,onComplete}:{student:StudentInfo;setStudent:(s:StudentInfo)=>void;answers:Answers;setAnswers:(a:Answers)=>void;index:number;setIndex:(i:number)=>void;onComplete:()=>void}){
  const [started,setStarted]=useState(!!student.name&&!!student.dob)

const q=questions[index]

const timedQuestion=
  q.section!=='Career Interests' &&
  q.section!=='Family Feasibility'

const [timeLeft,setTimeLeft]=useState(15)

const answersRef=useRef(answers)

useEffect(()=>{
  answersRef.current=answers
},[answers])

useEffect(()=>{
  if(!started || !timedQuestion){
    setTimeLeft(15)
    return
  }

  setTimeLeft(15)

  const timer=window.setInterval(()=>{
    setTimeLeft(previous=>{
      if(previous<=1){
        window.clearInterval(timer)

        const latestAnswers=answersRef.current

        if(latestAnswers[q.id]===undefined){
          const timedOutAnswers={
            ...latestAnswers,
            [q.id]:'__TIMEOUT__'
          }

          answersRef.current=timedOutAnswers
          setAnswers(timedOutAnswers)
        }

        window.setTimeout(()=>{
          if(index<questions.length-1){
            setIndex(index+1)
          }
        },50)

        return 0
      }

      return previous-1
    })
  },1000)

  return ()=>window.clearInterval(timer)

},[q.id,index,started,timedQuestion])
  if(!started) return <div className="assessment-shell"><div className="assessment-intro"><div className="assessment-copy"><span className="eyebrow">CREATE YOUR APPLICANT PROFILE</span><h1>Before the questions, tell PRISM who this assessment belongs to.</h1><p>Your date of birth is used only for the requested localhost return-login flow. For a real deployment, use proper password/OTP authentication instead.</p><div className="note"><Icon name="shield"/><span>Localhost demo data stays in this browser unless you connect a database later.</span></div></div><form className="form-card" onSubmit={e=>{e.preventDefault();if(student.name&&student.dob)setStarted(true)}}><label>Full name<input required value={student.name} onChange={e=>setStudent({...student,name:e.target.value})} placeholder="Student name"/></label><div className="form-grid"><label>Date of birth<input required type="date" value={student.dob} onChange={e=>setStudent({...student,dob:e.target.value})}/></label><label>Current city<input required value={student.city} onChange={e=>setStudent({...student,city:e.target.value})} placeholder="Chennai"/></label></div><label>Email <span>(optional)</span><input type="email" value={student.email} onChange={e=>setStudent({...student,email:e.target.value})} placeholder="name@example.com"/></label><button className="primary-btn full">Continue to assessment <Icon name="arrow"/></button></form></div></div>
  const pct=((index+1)/questions.length)*100
  const answered=q.type==='riasec'?q.riasecItems?.every(it=>Number((answers[q.id] as Record<string,number>|undefined)?.[it.code])):answers[q.id]!==undefined
  return <div className="quiz-page"><aside className="quiz-side"><div><span className="eyebrow">PRISM ASSESSMENT</span><h2>{q.section}</h2><p>Question screen {index+1} of {questions.length}</p></div><div className="section-map">{['Mathematics','Logical Reasoning','Technical Interest','Creative Problem Solving','Communication','Leadership','Career Interests','Family Feasibility'].map(s=><div key={s} className={q.section===s?'active':questions.findIndex(x=>x.section===s)<index?'done':''}><i/>{s}</div>)}</div><div className="quiz-side-foot"><span>{Math.round(pct)}% complete</span><div className="progress"><i style={{width:`${pct}%`}}/></div></div></aside><section className="question-stage" key={q.id}><div className="question-meta">
  <span>{q.id}</span>

  <span>
    {q.factor.replaceAll('_',' ')}
  </span>

  <span className={`question-timer ${timedQuestion&&timeLeft<=5?'danger':''}`}>
    {timedQuestion ? `${timeLeft}s` : 'UNTIMED'}
  </span>
</div><h1>{q.prompt}</h1>{q.type==='mcq'&&<div className="options">{q.options?.map((op,i)=><button key={op.value} className={answers[q.id]===op.value?'selected':''} onClick={()=>setAnswers({...answers,[q.id]:op.value})}><span>{String.fromCharCode(65+i)}</span><b>{op.label}</b><i/></button>)}</div>}{q.type==='scale'&&<Scale value={Number(answers[q.id]||0)} onChange={v=>setAnswers({...answers,[q.id]:v})}/>} {q.type==='riasec'&&<div className="riasec-items">{q.riasecItems?.map(item=><div className="rating-card" key={item.code}><div><span className="riasec-code">{item.code}</span><p>{item.text}</p></div><div className="rating-row">{[1,2,3,4,5].map(v=><button key={v} className={(answers[q.id] as Record<string,number>|undefined)?.[item.code]===v?'selected':''} onClick={()=>setAnswers({...answers,[q.id]:{...((answers[q.id] as Record<string,number>)||{}),[item.code]:v}})}>{v}<small>{v===1?'Low':v===5?'High':''}</small></button>)}</div></div>)}</div>}<div className="quiz-actions"><button className="secondary-btn" disabled={index===0} onClick={()=>setIndex(Math.max(0,index-1))}>Back</button>{index<questions.length-1?<button className="primary-btn" disabled={!answered} onClick={()=>setIndex(index+1)}>Continue <Icon name="arrow"/></button>:<button className="primary-btn finish" disabled={!answered} onClick={onComplete}>Generate my PRISM result <Icon name="spark"/></button>}</div></section></div>
}

function Scale({value,onChange}:{value:number;onChange:(n:number)=>void}){return <div className="scale-card"><div className="scale-labels"><span>Low</span><span>Neutral</span><span>High</span></div><div className="scale-options">{[1,2,3,4,5].map(v=><button key={v} onClick={()=>onChange(v)} className={value===v?'selected':''}><b>{v}</b><span>{['Very low','Low','Neutral','High','Very high'][v-1]}</span></button>)}</div></div>}

function Results({student,applicantId,factors,results,predictions,mlStatus,onDetail,onRetake}:{student:StudentInfo;applicantId:string;factors:FactorScores;results:DegreeResult[];predictions:Prediction[];mlStatus:string;onDetail:(r:DegreeResult)=>void;onRetake:()=>void}){
  const top=results[0]
  if(!top) return <Empty title="No assessment yet" body="Complete your PRISM assessment to generate results."/>
  const radar=[{label:'Student',value:top.studentFit},{label:'Family',value:top.familyFeasibility},{label:'Market',value:top.marketOpportunity},{label:'Math',value:factors.mathematics},{label:'Logic',value:factors.logical_reasoning},{label:'Interest',value:top.careerInterestMatch}]
  const strengths=Object.entries({Mathematics:factors.mathematics,'Logical reasoning':factors.logical_reasoning,'Technical interest':factors.technical_interest,'Creative problem solving':factors.creative_problem_solving,Communication:factors.communication,Leadership:factors.leadership}).sort((a,b)=>b[1]-a[1])
  function download(){const payload={generatedAt:new Date().toISOString(),applicantId,student:{name:student.name,city:student.city},prism:{topDegree:top.degree.name,score:+top.prismScore.toFixed(1),studentFit:+top.studentFit.toFixed(1),familyFeasibility:+top.familyFeasibility.toFixed(1),marketOpportunity:+top.marketOpportunity.toFixed(1),conflictIndex:+top.conflictIndex.toFixed(1)},sarash:predictions,notice:'SARASH prototype metrics were trained on synthetic labels. This report is decision support, not a guaranteed career outcome.'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${applicantId||'PRISM'}-prediction.json`;a.click();URL.revokeObjectURL(a.href)}
  return <div className="page results-page"><section className={`result-hero ${top.prismScore>=85?'excellent':''}`}><div><span className="eyebrow">PRISM ANALYSIS COMPLETE</span><h1>{top.prismScore>=85?'Excellent alignment, ':''}{student.name.split(' ')[0] || 'Applicant'}.</h1><p>Your strongest current pathway is <b>{top.degree.name}</b>. PRISM found a {scoreLabel(top.prismScore).toLowerCase()} across student fit, family feasibility and market opportunity.</p><div className="id-chip">Applicant ID <code>{applicantId}</code><span>Use this ID + DOB in DDMMYYYY to return on this browser.</span></div></div><ScoreRing score={top.prismScore} label="PRISM"/></section><div className="result-layout"><section className="panel radar-panel"><div className="panel-head"><div><span className="eyebrow">ANALYSIS WEB</span><h2>Your multi-factor shape</h2></div><span className="status-pill muted">Hover points for values</span></div>   <RadarChart items={radar}/><div className="legend-grid"><Legend label="Student Fit" value={top.studentFit}/><Legend label="Family Feasibility" value={top.familyFeasibility}/><Legend label="Market Opportunity" value={top.marketOpportunity}/><Legend label="Conflict Index" value={top.conflictIndex} inverse/></div></section><section className="panel top-paths"><div className="panel-head"><div><span className="eyebrow">TOP 3 PATHWAYS</span><h2>Ranked recommendations</h2></div></div>{results.slice(0,10).map((r,i)=><button className={`path-card ${i===0?'primary-path':''}`} key={r.degree.id} onClick={()=>onDetail(r)}><span className="path-rank">0{i+1}</span><div><b>{r.degree.short}</b><small>{r.degree.name}</small><div className="path-bars"><span><i style={{width:`${r.studentFit}%`}}/>Fit {fmt(r.studentFit)}</span><span><i style={{width:`${r.marketOpportunity}%`}}/>Market {fmt(r.marketOpportunity)}</span></div></div><strong>{fmt(r.prismScore)}</strong><Icon name="arrow"/></button>)}</section></div><section className="triple-grid"><div className="panel insight-card"><span className="card-kicker positive">STRENGTHS</span><h3>Your strongest signals</h3>{strengths.slice(0,3).map(([k,v])=><div className="insight-row" key={k}><span>{k}</span><b>{fmt(v)}</b></div>)}</div><div className="panel insight-card"><span className="card-kicker warning">DEVELOPMENT</span><h3>Where growth helps</h3>{strengths.slice(-3).reverse().map(([k,v])=><div className="insight-row" key={k}><span>{k}</span><b>{fmt(v)}</b></div>)}</div><div className="panel insight-card"><span className="card-kicker info">FAMILY ALIGNMENT</span><h3>{conflictLabel(top.conflictIndex)} conflict</h3><p>PRISM measures mismatch neutrally—it does not label the student or family as wrong.</p><div className="conflict-meter"><i style={{width:`${top.conflictIndex}%`}}/></div><small>{fmt(top.conflictIndex)}/100 conflict index</small></div></section><section className="panel ml-panel"><div><span className="eyebrow">SARASH ML PREDICTION</span><h2>Model layer</h2><p>The uploaded SARASH model produces separate match, conflict, market and final scores. It does not replace the transparent PRISM calculation.</p></div><div className="ml-state">{mlStatus==='loading'&&<><span className="spinner"/><b>Running SARASH locally…</b></>}{mlStatus==='offline'&&<><span className="warn-dot"/><b>Backend offline — PRISM result is still available.</b></>}{mlStatus==='ok'&&predictions.slice(0,3).map(p=><div className="ml-row" key={p.career}><span><b>{p.career}</b><small>Match {p.match_score} · Market {p.market_score} · Conflict {p.conflict_index}</small></span><strong>{p.sarash_score}</strong></div>)}</div></section><section className="result-actions"><button className="primary-btn xl" onClick={download}><Icon name="download"/> Download ML prediction</button><button className="secondary-btn xl" onClick={()=>window.print()}>Print / Save as PDF</button><button className="ghost-btn" onClick={()=>window.confirm('Retake the assessment? This will start a fresh local attempt.')&&onRetake()}>Retake assessment</button></section><div className="model-note"><Icon name="shield"/><p><b>Decision-support notice:</b> SARASH is a prototype trained on synthetic labels. Scores are useful for the hackathon demonstration but should not be presented as scientifically validated guarantees of future career success.</p></div></div>
}

function Legend({label,value,inverse=false}:{label:string;value:number;inverse?:boolean}){return <div className="legend-item"><span>{label}</span><b>{fmt(value)}</b><div><i style={{width:`${inverse?100-value:value}%`}}/></div></div>}

function Detail({result,prediction,onBack}:{result:DegreeResult;prediction?:Prediction;onBack:()=>void}){const d=result.degree;return <div className="page"><button className="back-link" onClick={onBack}>← Back to results</button><section className="detail-hero"><div><span className="eyebrow">DETAILED PATHWAY VIEW</span><h1>{d.name}</h1><p>{d.pathway}</p><div className="tag-row">{d.regions.map(x=><span key={x}>{x}</span>)}</div></div><ScoreRing score={result.prismScore} label="PRISM"/></section><div className="detail-grid"><section className="panel"><span className="eyebrow">WHY IT RANKED HERE</span><h2>Transparent score breakdown</h2><Break label="Student Fit" value={result.studentFit} text={`RIASEC career-interest match ${fmt(result.careerInterestMatch)}/100.`}/><Break label="Family Feasibility" value={result.familyFeasibility} text={`Budget fit ${fmt(result.budgetFit)}, location fit ${fmt(result.locationFit)}, loan fit ${fmt(result.loanFit)}.`}/><Break label="Market Opportunity" value={result.marketOpportunity} text="Configured demand, growth, salary, geography, economy and resilience signal."/><Break label="Conflict Index" value={result.conflictIndex} text={`${conflictLabel(result.conflictIndex)} mismatch between current family constraints and this pathway.`} danger/></section><section className="panel"><span className="eyebrow">SKILLS + PATHWAY</span><h2>What this route asks from you</h2><div className="skills">{d.skills.map(s=><span key={s}>{s}</span>)}</div><div className="timeline"><div><i>01</i><span><b>Foundation</b><small>Build core academics and introductory technical skills.</small></span></div><div><i>02</i><span><b>Portfolio</b><small>Projects, competitions, internships and evidence of applied ability.</small></span></div><div><i>03</i><span><b>Specialize</b><small>Choose a deeper track based on fit and market evidence.</small></span></div></div></section><section className="panel"><span className="eyebrow">ESTIMATED FEASIBILITY</span><h2>Cost + regions</h2><div className="big-stat"><small>Configured annual education range</small><b>₹{d.costLow}L – ₹{d.costHigh}L</b><span>Prototype estimate; institution fees vary.</span></div><div className="big-stat"><small>Opportunity regions</small><b>{d.regions.slice(0,2).join(' · ')}</b><span>Displayed from the current PRISM configuration.</span></div></section><section className="panel"><span className="eyebrow">SARASH LAYER</span><h2>{prediction?`${prediction.sarash_score}/100`:'Not connected'}</h2>{prediction?<><Break label="ML match" value={prediction.match_score} text="Pattern-based match from the uploaded SARASH model."/><Break label="ML market" value={prediction.market_score} text="Model market output from current backend inputs."/></>:<p className="muted-copy">Run the local FastAPI backend to add model predictions to this detailed view.</p>}</section></div></div>}
function Break({label,value,text,danger=false}:{label:string;value:number;text:string;danger?:boolean}){return <div className={`break-row ${danger?'danger':''}`}><div><span>{label}</span><b>{fmt(value)}/100</b></div><div className="break-bar"><i style={{width:`${value}%`}}/></div><p>{text}</p></div>}

function Profile({student,applicantId,factors,hasResults}:{student:StudentInfo;applicantId:string;factors:FactorScores;hasResults:boolean}){function logout(){if(window.confirm('Logout from this applicant profile? Your saved assessment will remain available for future login.')){localStorage.removeItem('prism.currentApplicant');localStorage.removeItem('prism.lastComplete');window.location.reload()}}return<div className="page"><section className="page-head"><div><span className="eyebrow">APPLICANT PROFILE</span><h1>{student.name||'New applicant'}</h1><p>{applicantId||'No applicant ID generated yet.'}</p></div><div className="head-actions"><div className="applicant-id"><span>Applicant ID</span><b>{applicantId||'—'}</b></div>{applicantId&&<button className="secondary-btn" onClick={logout}><Icon name="logout"/> Logout</button>}</div></section><div className="profile-grid"><section className="panel profile-card"><div className="avatar">{student.name?student.name.split(' ').map(x=>x[0]).slice(0,2).join(''):'P'}</div><h2>{student.name||'Complete an assessment'}</h2><p>{student.city||'Location not set'}</p><div className="info-list"><span><small>Applicant ID</small><b>{applicantId||'—'}</b></span><span><small>Email</small><b>{student.email||'Not provided'}</b></span><span><small>Assessment</small><b>{hasResults?'Completed':'Not completed'}</b></span></div></section><section className="panel"><span className="eyebrow">CURRENT SIGNALS</span><h2>Profile factors</h2>{Object.entries(factors).slice(0,6).map(([k,v])=><Break key={k} label={k.replaceAll('_',' ')} value={v} text=""/>)}</section></div></div>}

function Settings({theme,setTheme}:{theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void}){return <div className="page narrow"><section className="page-head"><div><span className="eyebrow">PREFERENCES</span><h1>Settings</h1><p>Personalize the PRISM interface on this browser.</p></div></section><section className="panel settings-list"><div className="setting-row"><div><b>Appearance</b><small>Choose the animated light or dark PRISM environment.</small></div><div className="segmented"><button className={theme==='light'?'active':''} onClick={()=>setTheme('light')}><Icon name="sun"/> Light</button><button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}><Icon name="moon"/> Dark</button></div></div><div className="setting-row"><div><b>Motion</b><small>Animations automatically respect your operating system's reduced-motion setting.</small></div><span className="status-pill muted">Adaptive</span></div><div className="setting-row"><div><b>Data location</b><small>This localhost build stores applicant records in browser localStorage.</small></div><span className="status-pill muted">Local browser</span></div></section></div>}
function Privacy(){return <div className="page narrow"><section className="page-head"><div><span className="eyebrow">PRIVACY & SECURITY</span><h1>Transparent by design</h1><p>This localhost build is a development prototype, not a production identity system.</p></div></section><section className="panel prose"><h2>Current local behavior</h2><p>Applicant data is stored in this browser's localStorage. The requested DOB login value is SHA-256 hashed before storage, but browser-side storage is still not suitable for production authentication.</p><h2>Production requirement</h2><p>Move applicant records to a protected server database, use proper password/OTP/passkey authentication, add role-based admin access, rate limits, audit logging and secure session cookies. Keep API keys server-side only.</p><h2>Model transparency</h2><p>The AI Guide explains verified PRISM/SARASH outputs. It should never silently rewrite calculated scores.</p></section></div>}
function Help(){return <div className="page narrow"><section className="page-head"><div><span className="eyebrow">HELP & SUPPORT</span><h1>Support center</h1><p>The support API is intentionally left ready for your later integration.</p></div></section><div className="faq-grid"><section className="panel"><h3>How is my score built?</h3><p>PRISM combines 40% Student Fit, 30% Family Feasibility and 30% Market Opportunity in this build.</p></section><section className="panel"><h3>Is SARASH the same as PRISM?</h3><p>No. PRISM is the transparent decision framework. SARASH is the uploaded ML layer that adds pattern-based predictions.</p></section><section className="panel"><h3>Why can a career rank lower?</h3><p>A pathway can have strong student fit but weaker family feasibility or market conditions. The detailed view shows each component separately.</p></section><section className="panel disabled-support"><h3>Contact support API</h3><p>Placeholder prepared. Connect your helpdesk/API later without changing the navigation.</p><button className="secondary-btn" disabled>Coming later</button></section></div></div>}

function Admin({overrides,setOverrides,onLogout}:{overrides:Record<string,Partial<Degree>>;setOverrides:(o:Record<string,Partial<Degree>>)=>void;onLogout:()=>void}){const [draft,setDraft]=useState(overrides);function field(id:string,key:keyof Degree,val:number){setDraft({...draft,[id]:{...(draft[id]||{}),[key]:val}})}function save(){if(window.confirm('Save these local PRISM market configuration changes?')){setOverrides(draft);alert('Local admin configuration saved.')}}return <div className="page"><section className="page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>PRISM configuration</h1><p>Localhost admin tool for market signal updates. Replace this with authenticated server persistence in production.</p></div><div className="head-actions"><button className="primary-btn" onClick={save}>Save updates</button><button className="secondary-btn" onClick={onLogout}><Icon name="logout"/> Logout</button></div></section><section className="panel admin-table"><div className="admin-row header"><span>Degree</span><span>Demand</span><span>Growth</span><span>Salary</span><span>Resilience</span></div>{degrees.map(d=><div className="admin-row" key={d.id}><span><b>{d.short}</b><small>{d.id}</small></span>{(['demand','growth','salary','resilience'] as const).map(k=><label key={k}><input type="number" min="0" max="100" value={Number(draft[d.id]?.[k]??d[k])} onChange={e=>field(d.id,k,Math.max(0,Math.min(100,Number(e.target.value))))}/></label>)}</div>)}</section></div>}

function ApplicantLogin({onClose,onLogin}:{onClose:()=>void;onLogin:(id:string,dob:string)=>Promise<string>}){const [id,setId]=useState('');const [dob,setDob]=useState('');const [err,setErr]=useState('');async function submit(e:FormEvent){e.preventDefault();setErr(await onLogin(id,dob))}return <Modal title="Returning applicant" onClose={onClose}><form className="modal-form" onSubmit={submit}><p>Enter the applicant ID generated after your assessment and DOB password in <b>DDMMYYYY</b>.</p><label>Applicant ID<input value={id} onChange={e=>setId(e.target.value.toUpperCase())} placeholder="PRISM-26-XXXXXX" required/></label><label>DOB password<input value={dob} onChange={e=>setDob(e.target.value)} placeholder="DDMMYYYY" inputMode="numeric" required/></label>{err&&<div className="form-error">{err}</div>}<button className="primary-btn full">Open my profile</button><small className="security-copy">This login is for the localhost prototype. Use real server authentication in production.</small></form></Modal>}
function AdminLogin({onClose,onSuccess}:{onClose:()=>void;onSuccess:()=>void}){const [pin,setPin]=useState('');const [err,setErr]=useState('');function submit(e:FormEvent){e.preventDefault();if(!ADMIN_PIN){setErr('Set VITE_PRISM_ADMIN_PIN in frontend/.env first.');return}if(pin!==ADMIN_PIN){setErr('Incorrect local admin PIN.');return}onSuccess()}return <Modal title="Administrator" onClose={onClose}><form className="modal-form" onSubmit={submit}><p>Configuration access for authorized PRISM administrators.</p><label>Local admin PIN<input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" required/></label>{err&&<div className="form-error">{err}</div>}<button className="primary-btn full">Open admin console</button><small className="security-copy">A VITE variable is visible to the browser and is not a production secret. Replace this demo gate with server-side RBAC.</small></form></Modal>}

function MobileNav({page,navTo}:{page:Page;navTo:(p:Page)=>void}){const nav:[Page,string,string][]=[['dashboard','home','Home'],['assessment','spark','Assess'],['results','chart','Results'],['profile','user','Profile'],['settings','settings','Settings']];return <nav className="mobile-nav">{nav.map(([p,i,l])=><button key={p} className={page===p?'active':''} onClick={()=>navTo(p)}><Icon name={i}/><span>{l}</span></button>)}</nav>}

function PrismChatbot({factors,answers,results,student}:{factors:FactorScores;answers:Answers;results:DegreeResult[];student:StudentInfo}){
  type Msg={role:'user'|'assistant';content:string;id:number}
  const [open,setOpen]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[messages,setMessages]=useState<Msg[]>([{role:'assistant',content:"Hi, I’m PRISM AI Guide. I can explain your scores, compare pathways, or help you understand family and market trade-offs.",id:1}]),[attachments,setAttachments]=useState<string[]>([])
  const [listening,setListening]=useState(false);const abortRef=useRef<AbortController|null>(null);const scrollRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[messages,busy,open])
  const quick=['Suggest a major','Why is my #1 pathway best?','Explain my conflict score','Which option has the strongest market?']
  async function send(forced?:string){const value=(forced??text).trim();if(!value||busy)return;const userMsg={role:'user' as const,content:value,id:Date.now()};const next=[...messages,userMsg];setMessages(next);setText('');setBusy(true);const ac=new AbortController();abortRef.current=ac;try{const body={message:value,student:toSarashStudent(factors),parent:toSarashParent(answers),choices:results.slice(0,3).map((r,i)=>({career:r.degree.career,rank:i+1,preference:Math.round(r.studentFit)})),location:student.city||'Chennai',history:next.slice(-8).map(m=>({role:m.role,content:m.content}))};const res=await fetch(`${API}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});if(!res.ok)throw new Error();const data=await res.json();const id=Date.now()+1;setMessages(m=>[...m,{role:'assistant',content:'',id}]);const full=String(data.answer||'');for(let i=1;i<=full.length;i+=3){if(ac.signal.aborted)break;const slice=full.slice(0,i);setMessages(m=>m.map(x=>x.id===id?{...x,content:slice}:x));await new Promise(r=>setTimeout(r,8))}}catch(e){if((e as Error).name!=='AbortError')setMessages(m=>[...m,{role:'assistant',content:'I could not reach the PRISM backend. Start the FastAPI server on port 8000 and try again.',id:Date.now()+4}])}finally{setBusy(false);abortRef.current=null}}
  function stop(){abortRef.current?.abort();setBusy(false)}
  function voice(){const W=(window as unknown as {webkitSpeechRecognition?:new()=>any;SpeechRecognition?:new()=>any});const R=W.SpeechRecognition||W.webkitSpeechRecognition;if(!R){setMessages(m=>[...m,{role:'assistant',content:'Voice recognition is not available in this browser.',id:Date.now()}]);return}const rec=new R();rec.lang='en-IN';rec.interimResults=false;setListening(true);rec.onresult=(e:any)=>{setText(e.results[0][0].transcript);setListening(false)};rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);rec.start()}
  return <div className={`chat-dock ${open?'open':''}`}><button className="chat-fab" onClick={()=>setOpen(!open)} aria-label="Open PRISM AI Guide"><span className="fab-ring"/><span className="bot-spin"><Icon name={open?'close':'bot'} size={24}/></span></button>{open&&<section className="chat-window"><header><div className="ai-avatar"><Icon name="bot"/></div><div><b>PRISM AI Guide</b><small><i/> SARASH-aware assistant</small></div><button className="icon-btn" onClick={()=>setOpen(false)}><Icon name="close"/></button></header><div className="chat-body" ref={scrollRef}>{messages.length===1&&<div className="chat-welcome"><div className="chat-logo"><Icon name="spark" size={26}/></div><h3>What would you like to understand?</h3><p>I explain PRISM and SARASH results without changing the calculated scores.</p><div className="prompt-cards">{quick.slice(0,4).map(q=><button onClick={()=>send(q)} key={q}>{q}<Icon name="arrow" size={14}/></button>)}</div></div>}{messages.map((m,i)=><div className={`message ${m.role}`} key={m.id}><div className="bubble"><RichText text={m.content}/></div><div className="msg-actions"><button onClick={()=>navigator.clipboard?.writeText(m.content)}>Copy</button>{m.role==='assistant'&&i===messages.length-1&&<button onClick={()=>{const last=[...messages].reverse().find(x=>x.role==='user');if(last)send(last.content)}}>Regenerate</button>}{m.role==='user'&&<button onClick={()=>setText(m.content)}>Edit</button>}{m.role==='assistant'&&<><button>Good</button><button>Needs work</button></>}</div></div>)}{busy&&<div className="typing"><i/><i/><i/><span>PRISM is thinking</span></div>}</div>{attachments.length>0&&<div className="attachment-strip">{attachments.map(x=><span key={x}>{x}<button onClick={()=>setAttachments(a=>a.filter(y=>y!==x))}>×</button></span>)}</div>}<footer className="composer"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Ask me anything..." rows={1}/><div className="composer-tools"><label className="icon-btn attach"><Icon name="paperclip"/><input type="file" accept="image/*,.pdf,.txt" multiple onChange={e=>setAttachments((Array.from(e.target.files||[]) as File[]).map(f=>f.name))}/></label><button className={`icon-btn ${listening?'listening':''}`} onClick={voice}><Icon name="mic"/></button><span className="shortcut">↵ send · ⇧↵ new line</span>{busy?<button className="stop-btn" onClick={stop}>Stop</button>:<button className="send-btn" onClick={()=>send()} disabled={!text.trim()}><Icon name="send"/></button>}</div></footer></section>}</div>
}

function InlineMarkdown({text}:{text:string}){const parts=text.split(/(\*\*[^*]+\*\*)/g);return <>{parts.map((p,i)=>p.startsWith('**')&&p.endsWith('**')?<strong key={i}>{p.slice(2,-2)}</strong>:p)}</>}
function RichText({text}:{text:string}){const chunks=text.split(/```/g);return <>{chunks.map((c,i)=>i%2===1?<pre key={i}><code>{c}</code><button onClick={()=>navigator.clipboard?.writeText(c)}>Copy</button></pre>:<div key={i}>{c.split('\n').map((line,j)=>line.startsWith('- ')?<div key={j}>• <InlineMarkdown text={line.slice(2)}/></div>:line.startsWith('### ')?<h4 key={j}><InlineMarkdown text={line.slice(4)}/></h4>:<p key={j}><InlineMarkdown text={line}/></p>)}</div>)}</>}
function Empty({title,body}:{title:string;body:string}){return <div className="empty-state"><span className="empty-icon"><Icon name="spark"/></span><h2>{title}</h2><p>{body}</p></div>}

export default App
