import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import PORT, CORS_ORIGINS, LOG_LEVEL
from api.router import router

app = FastAPI(
    title="SmartTech Analytics Service",
    description="Educational Intelligence & Analytics Microservice",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.split(",") if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "SmartTech Analytics Service",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/v2/analytics/health",
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        log_level=LOG_LEVEL.lower(),
        reload=True,
    )
