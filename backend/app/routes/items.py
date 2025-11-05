# backend/app/routes/items.py
from fastapi import APIRouter, Query
from ..core import db as db_module

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/")
async def list_items(q: str = Query(None, description="Filtro por code o type"), limit: int = 500):
    find_q = {}
    if q:
        find_q = {"$or": [
            {"code": {"$regex": q, "$options": "i"}},
            {"type": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]}
    cursor = db_module.db["items"].find(find_q, {"_id": 0}).limit(limit)
    return [doc async for doc in cursor]
