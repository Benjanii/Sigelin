from fastapi import APIRouter
from ..core import db as db_module  # ← importa el MÓDULO, no la variable

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])

@router.get("/db-ping")
async def db_ping():
    pong = await db_module.db.command("ping")      # ← usa db_module.db
    return {"ping": pong, "db_name": db_module.db.name}

@router.get("/db-collections")
async def db_collections():
    cols = await db_module.db.list_collection_names()
    return {"collections": cols}

@router.get("/items-count")
async def items_count():
    cnt = await db_module.db["items"].count_documents({})
    return {"count": cnt}
