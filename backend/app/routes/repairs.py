from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict
from datetime import datetime
from ..core import db as db_module
from ..services.security import require_roles, get_current_user

router = APIRouter(prefix="/repairs", tags=["repairs"])

# Estados extendidos
REPAIR_STATES = {"OPEN","IN_PROGRESS","CLOSED","EN_REPARACION","MALO","POR_REPARAR"}

def now_iso():
    return datetime.utcnow().isoformat()

@router.get("/")
async def list_repairs(status: Optional[str] = Query(None), limit:int=200):
    q = {}
    if status:
        q["status"] = status
    docs = [d async for d in db_module.db["repairs"].find(q, {"_id":0}).sort("date",-1).limit(limit)]
    return docs

@router.get("/{rep_id}")
async def get_repair(rep_id: str):
    rep = await db_module.db["repairs"].find_one({"id": rep_id}, {"_id":0})
    if not rep:
        raise HTTPException(status_code=404, detail="Repair not found")
    return rep

@router.post("/", dependencies=[Depends(require_roles(["ADMIN","TECH"]))])
async def create_repair(payload: dict, current=Depends(get_current_user)):
    """
    payload esperado:
    {
      // si el equipo existe:
      "equipmentCode": "EQ-0001",  // opcional si newEquipment=true
      "qr": "QR-EQ-0001",          // opcional si newEquipment=true

      // si es equipo nuevo:
      "newEquipment": true|false,  // si true, generamos code/qr automáticamente
      "type": "pc",                // requerido si newEquipment
      "location": "Lab-1",         // requerido si newEquipment

      // datos reparación:
      "status": "EN_REPARACION" | "IN_PROGRESS" | "POR_REPARAR" | "MALO" | "OPEN" | "CLOSED",
      "description": "detalle falla / trabajo",
      "softwareChanges": "...",    // opcional
      "hardwareChanges": "...",    // opcional
      "proposal": "...",           // requerido si status == "POR_REPARAR"
      "partsUsed": [ { "sku": "SSD-480", "qty": 1 }, ... ] // opcional
    }
    """
    st = payload.get("status") or "EN_REPARACION"
    if st not in REPAIR_STATES:
        raise HTTPException(status_code=400, detail="Invalid repair status")
    if st == "POR_REPARAR" and not payload.get("proposal"):
        raise HTTPException(status_code=400, detail="proposal is required when status is POR_REPARAR")

    code = payload.get("equipmentCode")
    qr   = payload.get("qr")

    if payload.get("newEquipment"):
        # generar code y qr
        code = code or f"EQ-{int(datetime.utcnow().timestamp())}"
        qr   = qr or f"QR-{code}"
        eq = {
            "code": code,
            "qr": qr,
            "type": payload.get("type") or "pc",
            "status": "REPAIR",
            "location": payload.get("location") or "Lab-1",
            "createdAt": now_iso()
        }
        await db_module.db["items"].insert_one(eq)
    else:
        # validar que el equipo exista y completar QR si falta
        eq = await db_module.db["items"].find_one({"code": code})
        if not eq:
            raise HTTPException(status_code=404, detail="Equipment not found")
        if not qr:
            qr = eq.get("qr")

    rep_id = f"REP-{int(datetime.utcnow().timestamp())}"
    doc = {
        "id": rep_id,
        "equipmentCode": code,
        "qr": qr,
        "status": st,
        "description": payload.get("description"),
        "softwareChanges": payload.get("softwareChanges"),
        "hardwareChanges": payload.get("hardwareChanges"),
        "proposal": payload.get("proposal"),
        "partsUsed": payload.get("partsUsed") or [],
        "technician": current["username"],
        "date": now_iso()
    }
    await db_module.db["repairs"].insert_one(doc)
    # opcional: marcar equipo en reparación
    if st in {"EN_REPARACION","IN_PROGRESS","POR_REPARAR"}:
        await db_module.db["items"].update_one({"code": code}, {"$set": {"status": "REPAIR"}})
    return {"created": True, "id": rep_id}

@router.patch("/{rep_id}", dependencies=[Depends(require_roles(["ADMIN","TECH"]))])
async def update_repair(rep_id: str, payload: dict):
    allowed = {k:v for k,v in payload.items() if k in {"status","description","softwareChanges","hardwareChanges","proposal","partsUsed"}}
    if "status" in allowed and allowed["status"] not in REPAIR_STATES:
        raise HTTPException(status_code=400, detail="Invalid repair status")
    res = await db_module.db["repairs"].update_one({"id": rep_id}, {"$set": allowed})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Repair not found")
    return {"updated": True}
