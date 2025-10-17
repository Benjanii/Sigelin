from fastapi import APIRouter, HTTPException
from ..core import db as db_module  # ¡importa el módulo!

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/_test_static")
async def test_static():
    return [{"code": "EQ-TEST", "type": "pc", "status": "OK", "location": "Lab-X"}]

@router.get("/")
async def list_items():
    try:
        if db_module.db is None:
            raise RuntimeError("DB no inicializada (db_module.db is None)")

        cursor = db_module.db["items"].find({}, {"_id": 0}).limit(50)
        items = await cursor.to_list(50)

        # Fuerza array pase lo que pase
        return items if isinstance(items, list) else []
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

@router.get("/{code}")
async def get_item(code: str):
    doc = await db_module.db["items"].find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return doc

@router.post("/")
async def add_item(item: dict):
    try:
        await db_module.db["items"].insert_one(item)
        return {"inserted": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {e}")
