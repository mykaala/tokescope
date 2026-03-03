# TokeScope

Stop burning money on LLM APIs without knowing why.

TokeScope is a self-hosted dashboard that tracks your OpenAI/Anthropic/Ollama usage in real-time:

- 💸 How much you're spending (and on what)
- ⚡️ Response times
- 🔥 Models that eat your budget
- 💀 Errors and failed calls
- 📊 Provider breakdowns

Think LangSmith or Helicone, but you own the data and it takes 2 minutes to set up.

---

## Dashboard

<p align="center">
  <img src="./assets/TokeScope.jpg" width="850">
</p>

---

## How It Works

Your App  
→ TokeScope SDK (wraps your API calls)  
→ FastAPI backend  
→ PostgreSQL  
→ React dashboard

Everything runs locally. No data leaves your machine.

---

## Quick Start

### 1. Fire up the backend

```bash
docker compose up -d
python -m uvicorn backend.main:app --reload --port 8000
```

### 2. Start the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` and you're done.

---

## Add to Your Project

Roughly:

```python
import tokescope
from openai import OpenAI

tokescope.init(api_key="test")  # any string works locally

client = OpenAI()

client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}]
)

# For scripts that exit immediately:
tokescope.flush()
```

That's all! Every API call from the supported providers now shows up in your dashboard.

---

## Why I Built This

At hackathons and projects, I kept:

- accidentally spending $50 on a buggy loop
- not knowing which model was faster/cheaper
- wishing I had LangSmith but not wanting to pay the price

So I built this in a weekend. It's:

- ✅ Free and open source
- ✅ Self-hosted (your API keys stay local)
- ✅ Works with OpenAI, Anthropic, Ollama (and more coming)
- ✅ Async (doesn't slow down your app)
- ✅ Privacy-first (doesn't log prompts by default)

---

## Tech Stack

- **SDK**: Python with async batching
- **Backend**: FastAPI + PostgreSQL
- **Dashboard**: React + Recharts
- **Deployment**: Docker Compose

No vendor commitment. No telemetry. Just a tool that does one thing well.

---

MIT License
