from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from api.endpoints import users, children, daily_logs, attendances, galleries, billings, chats, ai, registrations

from core.config import settings

app = FastAPI(
    title="AnaKu API",
    description="Backend API untuk Aplikasi Monitoring Anak AnaKu",
    version="1.0.0" 
)

origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to handle FastAPI CORS redirect issue by internally adding trailing slashes to API roots before routing
@app.middleware("http")
async def rewrite_trailing_slashes(request: Request, call_next):
    path = request.url.path
    # Primary API base resources that map to a "/" root route requiring trailing slash
    target_roots = {
        "/api/v1/users",
        "/api/v1/children",
        "/api/v1/daily-logs",
        "/api/v1/attendances",
        "/api/v1/galleries",
        "/api/v1/billings",
        "/api/v1/chats",
        "/api/v1/ai",
        "/api/v1/registrations"
    }
    if path in target_roots:
        request.scope["path"] = path + "/"
    
    response = await call_next(request)
    return response

# Error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"status": "error", "message": "Data tidak valid", "detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Terjadi kesalahan server", "detail": str(exc)}
    )

# Register routers
app.include_router(users.router,          prefix="/api/v1/users",         tags=["Users"])
app.include_router(children.router,       prefix="/api/v1/children",      tags=["Children"])
app.include_router(daily_logs.router,     prefix="/api/v1/daily-logs",    tags=["Daily Logs"])
app.include_router(attendances.router,    prefix="/api/v1/attendances",   tags=["Attendances"])
app.include_router(galleries.router,      prefix="/api/v1/galleries",     tags=["Galleries"])
app.include_router(billings.router,       prefix="/api/v1/billings",      tags=["Billings"])
app.include_router(chats.router,          prefix="/api/v1/chats",         tags=["Chats"])
app.include_router(ai.router,             prefix="/api/v1/ai",            tags=["AI"])
app.include_router(registrations.router,  prefix="/api/v1/registrations", tags=["Registrations"])

@app.get("/")
def root():
    return {"message": "AnaKu API is running 🚀", "docs": "/docs"}
