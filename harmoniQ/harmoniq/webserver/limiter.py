import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse

SERVER_LIMIT = 500
IP_LIMIT = 50
LIMIT_WINDOW = 60

GLOBAL_HISTORY = deque()
IP_HISTORY = defaultdict(deque)

def get_client_ip(request: Request) -> str:
    return request.client.host or "unknown"

async def rate_limit_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api"):
        return await call_next(request)

    now = time.time()
    client_ip = get_client_ip(request)
    

    while GLOBAL_HISTORY and (now - GLOBAL_HISTORY[0] > LIMIT_WINDOW):
        GLOBAL_HISTORY.popleft()
    
    if len(GLOBAL_HISTORY) >= SERVER_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Server Saturated: Collective request limit reached."}
        )

    history = IP_HISTORY[client_ip]
    while history and (now - history[0] > LIMIT_WINDOW):
        history.popleft()

    if len(history) >= IP_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Too many requests from IP {client_ip}. Please wait a minute."}
        )

    GLOBAL_HISTORY.append(now)
    history.append(now)

    return await call_next(request)
