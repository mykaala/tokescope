import queue
import threading
import time
import atexit
from typing import Callable, Optional, List

_log_queue: "queue.Queue[dict]" = queue.Queue()
_worker_started = False
_sender: Optional[Callable[[List[dict]], None]] = None

# holds the currently buffered batch inside the worker
_buffer: List[dict] = []
_buffer_lock = threading.Lock()


def start_worker(sender: Callable[[List[dict]], None], flush_interval_s: float = 1.0, max_batch: int = 50):
    global _worker_started, _sender
    if _worker_started:
        return

    _sender = sender

    def worker():
        global _buffer
        last_flush = time.time()

        while True:
            timeout = max(0.0, flush_interval_s - (time.time() - last_flush))
            try:
                item = _log_queue.get(timeout=timeout)
                with _buffer_lock:
                    _buffer.append(item)

                # flush on size
                with _buffer_lock:
                    should_flush = len(_buffer) >= max_batch
                if should_flush:
                    flush()
                    last_flush = time.time()

            except queue.Empty:
                # flush on timer
                flush()
                last_flush = time.time()

    def _atexit_flush():
        # best-effort final flush on program exit
        try:
            flush()
        except Exception:
            pass

    atexit.register(_atexit_flush)

    print("TokeScope worker starting...")
    threading.Thread(target=worker, daemon=True).start()
    _worker_started = True


def enqueue(item: dict):
    _log_queue.put(item)


def flush() -> None:
    """
    Force-send any buffered events immediately (best-effort).
    Safe to call from user code (e.g., in scripts/tests).
    """
    global _buffer
    if _sender is None:
        return

    with _buffer_lock:
        if not _buffer:
            return
        batch = _buffer
        _buffer = []

    try:
        _sender(batch)
    except Exception:
        # never crash user's app
        pass
