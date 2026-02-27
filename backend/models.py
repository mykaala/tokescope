from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, Text, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime
from .db import Base


class LLMCall(Base):
    __tablename__ = "llm_calls"

    id = Column(Integer, primary_key=True)
    workspace_key = Column(String, index=True, nullable=False)

    provider = Column(String, nullable=False, default="openai")
    model = Column(String, index=True)

    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    provider = Column(String, nullable=False, default="openai")

    endpoint_type = Column(String, nullable=False, default="chat.completions")
    status = Column(String, nullable=False, default="ok")
    error_type = Column(String, nullable=True)

    request_id = Column(String, nullable=False, index=True)
    client_ts = Column(String, nullable=False)

    app_id = Column(String, nullable=True)
    capture_content = Column(Boolean, nullable=False, default=False)
    messages = Column(JSON, nullable=True)
    response = Column(Text, nullable=True)
