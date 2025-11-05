# backend/app/routes/repairs.py
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime
from ..core import db as db_module
from ..services.security import require_roles, get_current_user

router = APIRouter(prefix="/repairs", tags=["repairs"])

def now_iso():
    return datetime.utcnow().isoformat()

# -----------------------------
#  Estados: SOLO lo que exista en Mongo (colección: RepairStates)
# -----------------------------
async def get_allowed_states() -> list[str]:
    """
    Lee estados desde Mongo. Intenta primero 'RepairStates' y luego 'repair_states'.
    Cada doc debe tener { value: "ESTADO" }.
    """
    values = []

    # 1) Intentar 'RepairStates'
    cursor1 = db_module.db["RepairStates"].find({}, {"_id": 0, "value": 1})
    vals1 = [ (doc.get("value") or "").strip().upper() async for doc in cursor1 ]
    values.extend([v for v in vals1 if v])

    # 2) Si no hay nada, intentar 'repair_states'
    if not values:
        cursor2 = db_module.db["repair_states"].find({}, {"_id": 0, "value": 1})
        vals2 = [ (doc.get("value") or "").strip().upper() async for doc in cursor2 ]
        values.extend([v for v in vals2 if v])

    # Dedup + orden
    values = sorted(set(values))

    if not values:
        # No hay estados en ninguna colección
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="No hay estados en 'RepairStates' ni en 'repair_states'.")

    return values

@router.get("/states")
async def list_states():
    """ Devuelve un arreglo plano, p.ej.: ["BUENO","MALO","EN_REPARACION"] """
    return await get_allowed_states()

# -----------------------------
#  Listado y lectura
# -----------------------------
@router.get("/")
async def list_repairs(status: Optional[str] = Query(None), limit:int=200):
    q = {}
    if status:
        q["status"] = str(status).strip().upper()
    docs = [d async for d in db_module.db["repairs"]
            .find(q, {"_id":0})
            .sort("date",-1)
            .limit(limit)]
    return docs

@router.get("/{rep_id}")
async def get_repair(rep_id: str):
    rep = await db_module.db["repairs"].find_one({"id": rep_id}, {"_id":0})
    if not rep:
        raise HTTPException(status_code=404, detail="Repair not found")
    return rep

# -----------------------------
#  Sincronización con inventario
# -----------------------------
async def _sync_item_status(equipment_code: str, canonical_status: str):
    """ Copia el estado canónico de la reparación a items.status tal cual. """
    if not equipment_code:
        return
    if not canonical_status:
        return
    await db_module.db["items"].update_one(
        {"code": equipment_code},
        {"$set": {"status": canonical_status}}
    )

# -----------------------------
#  Crear / Actualizar / Eliminar
# -----------------------------
@router.post("/", dependencies=[Depends(require_roles(["ADMIN","TECH"]))])
async def create_repair(payload: dict, current=Depends(get_current_user)):
    allowed = await get_allowed_states()

    # Estado: SOLO se acepta si está en RepairStates
    st_raw = payload.get("status")
    st = (st_raw or "").strip().upper()
    if st not in allowed:
        raise HTTPException(status_code=400, detail="Invalid repair status")

    code = payload.get("equipmentCode") or payload.get("device_code") or payload.get("code")
    qr   = payload.get("qr")

    if payload.get("newEquipment"):
        # generar code/qr si no vienen
        if not code:
            code = f"EQ-{int(datetime.utcnow().timestamp())}"
        if not qr:
            qr = f"QR-{code}"
        eq = {
            "code": code,
            "qr": qr,
            "type": payload.get("type") or "equipo",
            "status": st,  # estado igual al canónico
            "location": payload.get("location") or "Lab-1",
            "createdAt": now_iso()
        }
        await db_module.db["items"].insert_one(eq)
    else:
        # validar que exista
        eq = await db_module.db["items"].find_one({"code": code})
        if not eq:
            raise HTTPException(status_code=404, detail="Equipment not found")
        if not qr:
            qr = eq.get("qr")
        # si vino location al crear, opcionalmente actualizar items.location
        if (payload.get("location") or "").strip():
            await db_module.db["items"].update_one(
                {"code": code},
                {"$set": {"location": payload["location"].strip()}}
            )

    rep_id = f"REP-{int(datetime.utcnow().timestamp())}"
    doc = {
        "id": rep_id,
        "equipmentCode": code,
        "qr": qr,
        "status": st,  # guardamos el estado canónico tal cual en repairs
        "title": payload.get("title"),
        "description": payload.get("description"),
        "diagnostics": payload.get("diagnostics"),
        "actions": payload.get("actions"),
        "proposal": payload.get("proposal"),
        "parts_used": payload.get("parts_used") or payload.get("partsUsed") or [],
        "technician": current.get("username") if isinstance(current, dict) else None,
        "created_by": payload.get("created_by"),
        "notes": payload.get("notes"),
        "location": payload.get("location"),
        "date": now_iso()
    }
    await db_module.db["repairs"].insert_one(doc)

    # sincroniza estado del equipo
    await _sync_item_status(code, st)

    return {"created": True, "id": rep_id}

@router.patch("/{rep_id}", dependencies=[Depends(require_roles(["ADMIN","TECH"]))])
async def update_repair(rep_id: str, payload: dict):
    allowed = await get_allowed_states()

    # Campos que permitimos parchear
    allowed_patch_keys = {
        "status","title","description","diagnostics","actions",
        "proposal","parts_used","partsUsed","notes","location"
    }
    patch = {k:v for k,v in payload.items() if k in allowed_patch_keys}

    # normalizar y validar status si viene
    if "status" in patch:
        st_new = (patch["status"] or "").strip().upper()
        if st_new not in allowed:
            raise HTTPException(status_code=400, detail="Invalid repair status")
        patch["status"] = st_new

    # normaliza parts_used
    if "partsUsed" in patch and "parts_used" not in patch:
        patch["parts_used"] = patch.pop("partsUsed")

    res = await db_module.db["repairs"].update_one({"id": rep_id}, {"$set": patch})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Repair not found")

    # post-parche: sincroniza inventario si corresponde
    rep = await db_module.db["repairs"].find_one({"id": rep_id}, {"equipmentCode":1, "status":1, "_id":0})
    if rep:
        code = rep.get("equipmentCode")
        # si cambió status, reflejar en items
        if "status" in patch:
            await _sync_item_status(code, rep.get("status"))

        # si cambió location, reflejar en items
        if "location" in patch and (patch["location"] or "").strip():
            await db_module.db["items"].update_one(
                {"code": code},
                {"$set": {"location": patch["location"].strip()}}
            )

    return {"updated": True}

@router.delete("/{rep_id}", dependencies=[Depends(require_roles(["ADMIN"]))])
async def delete_repair(rep_id: str):
    res = await db_module.db["repairs"].delete_one({"id": rep_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Repair not found")
    return {"deleted": True}
