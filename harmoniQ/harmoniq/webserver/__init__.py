from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from pathlib import Path

from harmoniq.webserver.REST import router as api_router

ANGULAR_DIST = Path(__file__).parents[3] / "client" / "dist" / "client" / "browser"
ANGULAR_INDEX = ANGULAR_DIST / "index.html"

app = FastAPI(
    title="HarmoniQ",
    description="Outil de modélisation de production d'énergie au Québec",
    version="0.1",
    contact={
        "name": "Sébastien Dasys",
        "email": "sebastien.dasys@polymtl.ca",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:5000", "http://127.0.0.1:5000", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SPAFallbackMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if response.status_code != 404:
            return response

        path = request.url.path.lstrip("/")

        if path.startswith("api"):
            return response

        if not ANGULAR_INDEX.exists():
            return Response(
                content=f"Angular build not found at {ANGULAR_DIST}. Please build the client first.",
                status_code=404
            )

        candidate = ANGULAR_DIST / path
        if candidate.is_file():
            return FileResponse(candidate)

        return FileResponse(ANGULAR_INDEX)


app.add_middleware(SPAFallbackMiddleware)

app.include_router(api_router)
