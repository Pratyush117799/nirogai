"""
NirogAI — FastAPI ML Service
=============================
File: ml_service/main.py

Run:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Test:
    http://localhost:8000/docs   ← Swagger UI, test all endpoints here
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routes.diabetes import router as diabetes_router
# from routes.anemia import router as anemia_router      ← uncomment when ready
# from routes.skin    import router as skin_router        ← uncomment when ready


# ── Preload models at startup (faster first request) ──────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 NirogAI ML Service starting...")
    try:
        from routes.diabetes import load_bundle
        load_bundle()
        print("✅ Diabetes model loaded")
    except Exception as e:
        print(f"⚠️  Diabetes model failed to load: {e}")
    yield
    print("🛑 NirogAI ML Service shutting down")


app = FastAPI(
    title       = "NirogAI — Disease Screening ML Service",
    description = "AI-powered diabetes, anemia, and skin disorder screening",
    version     = "1.0.0",
    lifespan    = lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],   # In production: set to your Render/Vercel URL
    allow_methods  = ["*"],
    allow_headers  = ["*"]
)

app.include_router(diabetes_router, prefix="/diabetes", tags=["Diabetes"])
# app.include_router(anemia_router,   prefix="/anemia",   tags=["Anemia"])
# app.include_router(skin_router,     prefix="/skin",     tags=["Skin"])


@app.get("/")
async def root():
    return {
        "service": "NirogAI ML Service",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "NirogAI ML API"}
