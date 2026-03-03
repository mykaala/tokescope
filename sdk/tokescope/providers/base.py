from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class NormalizedEvent:
    provider: str
    endpoint_type: str
    model: Optional[str]

    prompt_tokens: int
    completion_tokens: int
    latency_ms: int

    status: str  # "ok" | "error"
    error_type: Optional[str]

    request_id: Optional[str]
    client_ts: Optional[str]

    app_id: Optional[str]
    capture_content: bool
    messages: Optional[Any]
    response: Optional[str]


class ProviderPatcher:
    """
    A provider patcher knows how to install patches for one provider.
    It should be idempotent (safe to call twice).
    """
    name: str

    def patch(self) -> None:
        raise NotImplementedError
