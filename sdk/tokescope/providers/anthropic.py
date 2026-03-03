from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from .base import ProviderPatcher, NormalizedEvent
from ..collector import get_config
from ..queue import enqueue

_original_messages_create = None


class AnthropicMessagesPatcher(ProviderPatcher):
    name = "anthropic"

    def patch(self) -> None:
        global _original_messages_create
        if _original_messages_create is not None:
            return  # already patched

        try:
            from anthropic.resources.messages import Messages
        except Exception:
            return

        _original_messages_create = Messages.create

        def patched_create(self, *args, **kwargs):
            cfg = get_config()
            capture = bool(cfg.get("capture_content", False))
            app_id = cfg.get("app_id")

            req_id = str(uuid.uuid4())
            client_ts = datetime.now(timezone.utc).isoformat()

            start = time.time()
            try:
                resp = _original_messages_create(self, *args, **kwargs)
                latency_ms = int(round((time.time() - start) * 1000))

                usage = getattr(resp, "usage", None)
                prompt_tokens = int(getattr(usage, "input_tokens", 0) or 0)
                completion_tokens = int(
                    getattr(usage, "output_tokens", 0) or 0)

                resp_text: Optional[str] = None
                try:
                    blocks = getattr(resp, "content", None)
                    if isinstance(blocks, list):
                        parts = []
                        for b in blocks:
                            t = getattr(b, "text", None)
                            if t:
                                parts.append(t)
                        resp_text = "\n".join(parts) if parts else None
                    else:
                        resp_text = str(resp)
                except Exception:
                    resp_text = None

                event = NormalizedEvent(
                    provider="anthropic",
                    endpoint_type="messages.create",
                    model=kwargs.get("model"),
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    latency_ms=latency_ms,
                    status="ok",
                    error_type=None,
                    request_id=req_id,
                    client_ts=client_ts,
                    app_id=app_id,
                    capture_content=capture,
                    messages=kwargs.get("messages") if capture else None,
                    response=resp_text if capture else None,
                )
                enqueue(event.__dict__)
                return resp

            except Exception as e:
                latency_ms = int(round((time.time() - start) * 1000))
                event = NormalizedEvent(
                    provider="anthropic",
                    endpoint_type="messages.create",
                    model=kwargs.get("model"),
                    prompt_tokens=0,
                    completion_tokens=0,
                    latency_ms=latency_ms,
                    status="error",
                    error_type=type(e).__name__,
                    request_id=req_id,
                    client_ts=client_ts,
                    app_id=app_id,
                    capture_content=capture,
                    messages=kwargs.get("messages") if capture else None,
                    response=None,
                )
                enqueue(event.__dict__)
                raise

        Messages.create = patched_create
