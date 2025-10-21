# backend/app/routes/inventory.py
from fastapi import APIRouter, HTTPException, Depends
from ..core import db as db_module
from ..services.security import require_roles

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/")
async def list_items():
    items = [doc async for doc in db_module.db["items"].find({}, {"_id":0}).limit(200)]
    return items

# ADMIN agrega item DIRECTO (sin purchaseId)
@router.post("/", dependencies=[Depends(require_roles(["ADMIN"]))])
async def add_item(item: dict):
    """
    item esperado:
    {
      "code": "EQ-001",
      "type": "pc",
      "status": "OK",
      "location": "Lab-1",
      "qr": "QR-001"
    }
    """
    code = item.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="code is required")

    exists = await db_module.db["items"].find_one({"code": code})
    if exists:
        raise HTTPException(status_code=400, detail="Item code already exists")

    await db_module.db["items"].insert_one(item)
    return {"inserted": True}

VALID_STATUS = {"OK","REPAIR","LOWINK","EN_REPARACION","MALO","POR_REPARAR"}

@router.patch("/{code}", dependencies=[Depends(require_roles(["ADMIN"]))])
async def update_item(code: str, payload: dict):
    upd = {}
    if "type" in payload: upd["type"] = payload["type"]
    if "status" in payload:
        if payload["status"] not in VALID_STATUS:
            raise HTTPException(status_code=400, detail="Invalid status")
        upd["status"] = payload["status"]
    if "location" in payload: upd["location"] = payload["location"]
    if not upd:
        raise HTTPException(status_code=400, detail="Only type/status/location can be updated")
    res = await db_module.db["items"].update_one({"code": code}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"updated": True}

# ADMIN elimina item
@router.delete("/{code}", dependencies=[Depends(require_roles(["ADMIN"]))])
async def delete_item(code: str):
    res = await db_module.db["items"].delete_one({"code": code})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"deleted": True}

