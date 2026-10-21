import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, per_minute, clock=time.monotonic):
        self.per_minute = per_minute
        self.clock = clock
        self.calls = defaultdict(deque)

    def allow(self, key):
        if self.per_minute <= 0:
            return True
        now = self.clock()
        window = self.calls[key]
        while window and now - window[0] >= 60:
            window.popleft()
        if len(window) >= self.per_minute:
            return False
        window.append(now)
        return True
