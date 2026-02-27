from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine, get_db
from .models import LLMCall
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


class CallLog(BaseModel):
    provider: str = "openai"
    endpoint_type: str = "chat.completions"
    model: Optional[str] = None

    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0

    status: str = "ok"              # "ok" or "error"
    error_type: Optional[str] = None

    request_id: Optional[str] = None
    client_ts: Optional[str] = None

    app_id: Optional[str] = None
    capture_content: bool = False
    messages: Optional[list[dict]] = None
    response: Optional[str] = None


PRICING_PER_1M = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 5.00, "output": 15.00},
}


def estimate_cost_usd(model: Optional[str], prompt_tokens: int, completion_tokens: int) -> float:
    p = PRICING_PER_1M.get(model or "", {"input": 1.0, "output": 2.0})
    return (prompt_tokens / 1_000_000) * p["input"] + (completion_tokens / 1_000_000) * p["output"]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest(
    batch: List[CallLog],
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key")

    batch_cost = 0.0
    for e in batch:
        rid = e.request_id or str(uuid.uuid4())
        cts = e.client_ts or datetime.now(timezone.utc).isoformat()
        cost = estimate_cost_usd(e.model, e.prompt_tokens, e.completion_tokens)
        batch_cost += cost

        db.add(
            LLMCall(
                workspace_key=x_api_key,
                provider=e.provider,
                endpoint_type=e.endpoint_type,
                model=e.model,
                prompt_tokens=e.prompt_tokens,
                completion_tokens=e.completion_tokens,
                latency_ms=e.latency_ms,
                cost_usd=cost,
                status=e.status,
                error_type=e.error_type,
                request_id=rid,
                client_ts=cts,
                app_id=e.app_id,
                capture_content=e.capture_content,
                messages=e.messages,
                response=e.response,
            )
        )

    db.commit()

    print(
        f"\n--- ingest {datetime.utcnow().isoformat()} workspace={x_api_key} "
        f"count={len(batch)} batch_cost=${batch_cost:.6f}"
    )

    return {"status": "ok", "received": len(batch), "batch_cost_usd": round(batch_cost, 6)}


@app.get("/metrics/summary")
def summary(
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key")

    q = db.query(LLMCall).filter(LLMCall.workspace_key == x_api_key)

    total_calls = q.count()
    total_cost = db.query(func.coalesce(func.sum(LLMCall.cost_usd), 0.0)).filter(
        LLMCall.workspace_key == x_api_key).scalar()
    avg_latency = db.query(func.coalesce(func.avg(LLMCall.latency_ms), 0.0)).filter(
        LLMCall.workspace_key == x_api_key).scalar()

    by_model = (
        db.query(LLMCall.model, func.count(
            LLMCall.id), func.sum(LLMCall.cost_usd))
        .filter(LLMCall.workspace_key == x_api_key)
        .group_by(LLMCall.model)
        .all()
    )

    return {
        "total_calls": total_calls,
        "total_cost_usd": round(float(total_cost), 6),
        "avg_latency_ms": round(float(avg_latency), 2),
        "by_model": [
            {"model": m, "calls": int(
                c), "cost_usd": round(float(s or 0.0), 6)}
            for (m, c, s) in by_model
        ],
    }


@app.get("/metrics/calls")
def recent_calls(
    limit: int = 50,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key")

    calls = (
        db.query(LLMCall)
        .filter(LLMCall.workspace_key == x_api_key)
        .order_by(LLMCall.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "model": c.model,
            "provider": c.provider,
            "prompt_tokens": c.prompt_tokens,
            "completion_tokens": c.completion_tokens,
            "latency_ms": c.latency_ms,
            "cost_usd": round(c.cost_usd, 6),
            "created_at": c.created_at.isoformat(),
        }
        for c in calls
    ]
