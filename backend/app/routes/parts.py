# backend/app/routes/parts.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from ..core import db as db_module
from ..services.security import require_roles, get_current_user

router = APIRouter(prefix="/parts", tags=["parts"])

@router.get("/")
async def list_parts(limit: int = 200):
    """
    Lista de repuestos (solo lectura para TECH y DIRECTOR).
    ADMIN también ve esta lista.
    """
    parts = [p async for p in db_module.db["parts"].find({}, {"_id": 0}).limit(limit)]
    return parts

@router.get("/{sku}")
async def get_part(sku: str):
    part = await db_module.db["parts"].find_one({"sku": sku}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    return part

@router.post("/", dependencies=[Depends(require_roles(["ADMIN"]))])
async def create_or_update_part(payload: dict, current=Depends(get_current_user)):
    """
    Crea o ACTUALIZA las especificaciones del repuesto, SOLO si viene ligado a una compra APROBADA.
    NO modifica el stock aquí (el stock se suma al APROBAR la compra en /purchases/{id}/decision).

    payload esperado:
    {
      "purchaseId": "PO-...",               # obligatorio y debe estar APPROVED
      "sku": "SSD-480",                     # obligatorio y debe existir en los items de esa PO
      "name": "SSD 480GB Kingston",         # obligatorio (metadatos)
      "minStock": 2,                        # opcional (default 0)
      "unit": "unidad",                     # opcional (default "unidad")
      "category": "almacenamiento",         # opcional (default "otro")
      "location": "Bodega A - Estante 3",   # opcional
      "description": "Uso general notebooks" # opcional
    }
    """
    po_id: Optional[str] = payload.get("purchaseId")
    sku: Optional[str] = payload.get("sku")
    name: Optional[str] = payload.get("name")

    if not po_id or not sku or not name:
        raise HTTPException(status_code=400, detail="purchaseId, sku y name son obligatorios")

    # 1) Validar que la compra exista y esté APROBADA
    po = await db_module.db["purchases"].find_one({"id": po_id})
    if not po:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if po.get("status") != "APPROVED":
        raise HTTPException(status_code=400, detail="La compra debe estar APROBADA")

    # 2) Validar que el SKU pertenezca a los ítems de esa compra
    po_skus = {itm.get("sku") for itm in po.get("items", []) if itm.get("sku")}
    if sku not in po_skus:
        raise HTTPException(status_code=400, detail="El SKU no pertenece a esa compra aprobada")

    # 3) Upsert de metadatos del repuesto (NO tocamos stock aquí)
    update_doc = {
        "sku": sku,
        "name": name,
        "minStock": int(payload.get("minStock", 0)),
        "unit": payload.get("unit") or "unidad",
        "category": payload.get("category") or "otro",
        "location": payload.get("location"),
        "description": payload.get("description"),
    }

    await db_module.db["parts"].update_one(
        {"sku": sku},
        {"$set": update_doc},
        upsert=True
    )
    return {"saved": True, "sku": sku}
