import queue
import threading
import time
from typing import Callable, Optional, List, Any

_log_queue: "queue.Queue[dict]" = queue.Queue()
_worker_started = False
_sender: Optional[Callable[[List[dict]], None]] = None


def start_worker(sender: Callable[[List[dict]], None], flush_interval_s: float = 1.0, max_batch: int = 50):
    """
    Start a single background worker that batches logs and sends them via `sender`.
    """
    global _worker_started, _sender
    if _worker_started:
        return

    _sender = sender

    def worker():
        batch: List[dict] = []
        last_flush = time.time()

        while True:
            timeout = max(0.0, flush_interval_s - (time.time() - last_flush))
            try:
                item = _log_queue.get(timeout=timeout)
                batch.append(item)
                if len(batch) >= max_batch:
                    print(f"Sending batch of {len(batch)} logs")
                    _flush(batch)
                    batch = []
                    last_flush = time.time()
            except queue.Empty:
                if batch:
                    print(f"Flushing batch of {len(batch)} logs")
                    _flush(batch)
                    batch = []
                last_flush = time.time()
    print("TokeScope worker starting...")
    threading.Thread(target=worker, daemon=True).start()
    _worker_started = True


def enqueue(item: dict):
    print("ENQUEUE:", item)
    _log_queue.put(item)


def _flush(batch):
    if _sender is None:
        return
    try:
        _sender(batch)
    except Exception as e:
        print("SEND ERROR:", repr(e))
