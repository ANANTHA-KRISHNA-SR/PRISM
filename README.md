[README.md](https://github.com/user-attachments/files/33184451/README.md)
# PRISM Engine — Localhost Website

A high-fidelity localhost implementation of the PRISM career-guidance UI integrated with the uploaded SARASH PyTorch prototype and PRISM AI Guide backend.

## Included

- Animated premium light + dark modes
- Fully responsive mobile / tablet / laptop / desktop layouts
- 29-screen assessment flow (24 student + 5 family screens)
- RIASEC radar/web chart
- Transparent PRISM score: 40% Student Fit + 30% Family Feasibility + 30% Market Opportunity
- Celebration UX with confetti for excellent results
- Top-3 pathways + detailed pathway view
- Uploaded SARASH model integration via FastAPI `/predict`
- Floating PRISM AI Guide with typing animation, quick prompts, file/image picker UI, voice input where the browser supports it, copy/regenerate/edit/feedback actions, and stop generation
- Returning-applicant flow using generated ID + DOB in DDMMYYYY
- Localhost admin configuration page
- JSON download of the ML prediction and browser Print / Save as PDF
- Profile, Settings, Privacy & Security, Help / Support placeholder
- Loading, empty, error and offline states

## Important authentication note

The applicant/admin flows in this package are **localhost demo authentication**, not production authentication. Applicant data lives in browser `localStorage`. The DOB password is SHA-256 hashed before storage, but client-side storage is not secure enough for a real deployment. The admin Vite variable is also visible in browser code.

For production, move identity/profile storage server-side and use password/OTP/passkey authentication, secure cookies, database-backed sessions and role-based access control.

## 1. Run the SARASH / chatbot backend

From the project root:

### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app:app --reload --port 8000
```

The uploaded environment already contained the required scientific packages during build testing, but on your own PC run `pip install -r requirements.txt`.

Open:

```text
http://localhost:8000/health
```

Default `.env.example` uses `PRISM_DEMO_MODE=true`, so the chatbot still works without an OpenAI API key. Add your own server-side keys later if needed.

## 2. Run the frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

The default local admin PIN in `.env.example` is `2468`. This is only for the localhost demo.

## 3. Applicant return login

After completing an assessment, the results screen generates an ID similar to:

```text
PRISM-26-ABC123
```

Use that ID and DOB formatted as `DDMMYYYY` in **Returning applicant**.

## 4. Model files

The backend keeps the uploaded model artifacts in:

```text
backend/model/sarash_model.pt
backend/model/sarash_scaler.joblib
```

The frontend never receives these model files or API secrets.

## 5. Production next steps

1. Replace localStorage profiles with PostgreSQL/Supabase.
2. Add server-side applicant + admin authentication.
3. Store assessment questions and degree profiles in the database.
4. Replace the localhost admin market editor with authenticated API updates + audit log.
5. Validate/retrain SARASH on real longitudinal student outcomes before making predictive claims.
6. Add licensed/current labour-market feeds and source provenance.
7. Add a real support/helpdesk API when ready.
