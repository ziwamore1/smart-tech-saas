import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("ANALYTICS_SERVICE_PORT", "8000"))
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3001/api/v1")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "report-service-key")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
