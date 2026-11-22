"""Простое ограничение попыток входа (в пределах процесса)."""

import time
from collections import deque
from threading import Lock
from typing import Deque, Dict


class LoginRateLimiter:
    """Считает неудачные попытки входа за скользящее окно.

    Ограничение действует в рамках одного процесса. Для нескольких
    uvicorn-воркеров его следует перенести в Redis.
    """

    def __init__(self, limit: int, window_seconds: int) -> None:
        self._limit = max(1, limit)
        self._window = max(1, window_seconds)
        self._attempts: Dict[str, Deque[float]] = {}
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> Deque[float]:
        bucket = self._attempts.setdefault(key, deque())
        boundary = now - self._window
        while bucket and bucket[0] <= boundary:
            bucket.popleft()
        if not bucket:
            self._attempts.pop(key, None)
            return deque()
        return bucket

    def is_limited(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._prune(key, now)
            return len(bucket) >= self._limit

    def register_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._prune(key, now)
            bucket.append(now)
            self._attempts[key] = bucket

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)
