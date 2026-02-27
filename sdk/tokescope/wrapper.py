import time
import uuid
from datetime import datetime, timezone
from .collector import enqueue_log, get_config


def wrap_client(client):
    original = client.chat.completions.create

    def wrapped_create(*args, **kwargs):
        cfg = get_config()
        start = time.time()
        req_id = str(uuid.uuid4())
        client_ts = datetime.now(timezone.utc).isoformat()

        try:
            response = original(*args, **kwargs)
            latency_ms = round((time.time() - start) * 1000)

            usage = getattr(response, "usage", None)
            event = {
                "provider": "openai",
                "endpoint_type": "chat.completions",
                "model": kwargs.get("model"),
                "prompt_tokens": getattr(usage, "prompt_tokens", 0),
                "completion_tokens": getattr(usage, "completion_tokens", 0),
                "latency_ms": latency_ms,
                "status": "ok",
                "error_type": None,
                "request_id": req_id,
                "client_ts": client_ts,
                "app_id": cfg["app_id"],
                "capture_content": cfg["capture_content"],
                "messages": kwargs.get("messages") if cfg["capture_content"] else None,
                "response": getattr(response.choices[0].message, "content", None) if cfg["capture_content"] else None,
            }
            enqueue_log(event)
            return response

        except Exception as e:
            latency_ms = round((time.time() - start) * 1000)
            event = {
                "provider": "openai",
                "endpoint_type": "chat.completions",
                "model": kwargs.get("model"),
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "latency_ms": latency_ms,
                "status": "error",
                "error_type": type(e).__name__,
                "request_id": req_id,
                "client_ts": client_ts,
                "app_id": cfg["app_id"],
                "capture_content": cfg["capture_content"],
                "messages": kwargs.get("messages") if cfg["capture_content"] else None,
                "response": None,
            }
            enqueue_log(event)
            raise

    client.chat.completions.create = wrapped_create
    return client
