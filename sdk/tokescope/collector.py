import requests
from typing import List, Optional
from .queue import enqueue, start_worker

_api_key: Optional[str] = None
_endpoint = "http://localhost:8000/ingest"
_capture_content = False
_debug = False
_app_id = None


def init(api_key: str, endpoint: str = None, capture_content: bool = False, debug: bool = False, app_id: str = None):
    global _api_key, _endpoint, _capture_content, _debug, _app_id
    _api_key = api_key
    if endpoint:
        _endpoint = endpoint
    _capture_content = capture_content
    _debug = debug
    _app_id = app_id
    start_worker(sender=send_batch)

    # Start worker and pass the sender function (no circular imports)

    start_worker(sender=send_batch)


def enqueue_log(log: dict):
    enqueue(log)


def send_batch(batch: List[dict]):
    print("Sending batch to", _endpoint, "count=", len(batch))
    if not _api_key:
        return

    requests.post(
        _endpoint,
        json=batch,
        headers={"X-API-Key": _api_key},
        timeout=2,
    )


def get_config():
    return {"capture_content": _capture_content, "debug": _debug, "app_id": _app_id}
