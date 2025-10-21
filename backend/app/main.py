from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

# conexión BD
from .core.db import connect, disconnect

# routers
from .routes.health import router as health_router
from .routes.inventory import router as inventory_router
from .routes.diagnostics import router as diagnostics_router
from .routes.auth import router as auth_router
from .routes.repairs import router as repairs_router
from .routes.parts import router as parts_router
from .routes.purchases import router as purchases_router
from .routes.admin import router as admin_router
from .routes.reports import router as reports_router

# --- Lifespan: reemplaza on_event startup/shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()         # antes de servir: conecta a Mongo
    try:
        yield               # la app corre aquí
    finally:
        await disconnect()  # al terminar: desconecta

# ÚNICA instancia FastAPI con lifespan
app = FastAPI(title="SIGELIN API", lifespan=lifespan)

# CORS: permite que el frontend (Vite) llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",      # por si Vite cambia de puerto
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# (opcional) raíz que redirige a Swagger
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

# registra rutas
app.include_router(health_router)
app.include_router(inventory_router)
app.include_router(diagnostics_router)
app.include_router(auth_router)
app.include_router(repairs_router)
app.include_router(parts_router)
app.include_router(purchases_router)
app.include_router(admin_router)
app.include_router(reports_router)