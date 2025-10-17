from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# importa conexión a la BD
from .core.db import connect, disconnect

# importa routers
from .routes.health import router as health_router
from .routes.inventory import router as inventory_router
from .routes.diagnostics import router as diagnostics_router

# ÚNICA instancia de FastAPI
app = FastAPI(title="SIGELIN API")

# CORS: permite que el frontend (Vite) llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",      # <-- agrega si Vite cambió de puerto
        "http://127.0.0.1:5174"],  # origen del frontend en dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# hooks de inicio/cierre (conexión a Mongo)
@app.on_event("startup")
async def startup():
    await connect()

@app.on_event("shutdown")
async def shutdown():
    await disconnect()

# registra rutas
app.include_router(health_router)
app.include_router(inventory_router)
app.include_router(diagnostics_router)
