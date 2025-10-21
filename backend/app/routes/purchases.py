# backend/app/routes/purchases.py
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from typing import Optional, List, Dict
from ..core import db as db_module
from ..services.security import require_roles, get_current_user

router = APIRouter(prefix="/purchases", tags=["purchases"])

@router.get("/")
async def list_purchases(status: Optional[str] = Query(None, pattern="^(PENDING|APPROVED|REJECTED)$"), limit: int = 100):
    q = {}
    if status:
        q["status"] = status
    docs = [d async for d in db_module.db["purchases"].find(q, {"_id":0}).sort("date",-1).limit(limit)]
    return docs

@router.post("/", dependencies=[Depends(require_roles(["ADMIN"]))])
async def create_purchase(payload: dict, current=Depends(get_current_user)):
    """
    payload: {
      "supplier": "ABC",
      "items": [
        // producto existente:
        { "sku": "P-SSD-240", "qty": 5 },

        // producto nuevo:
        { "sku": "P-NUEVO-001", "qty": 3, "name": "Nombre descriptivo" }
      ],
      "note": "Compra repuestos",  // opcional
      "category": "parts"          // dejamos compras para repuestos
    }
    """
    supplier = payload.get("supplier")
    items: List[Dict] = payload.get("items", [])
    category = payload.get("category") or "parts"
    if not supplier or not items:
        raise HTTPException(status_code=400, detail="supplier and items required")
    if category != "parts":
        # Según tu regla: compras son solo para repuestos
        raise HTTPException(status_code=400, detail="Only 'parts' purchases are supported")

    for it in items:
        if not it.get("sku") or int(it.get("qty",0)) <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid item: {it}")

    po_id = f"PO-{int(datetime.utcnow().timestamp())}"
    doc = {
        "id": po_id,
        "supplier": supplier,
        "items": items,
        "note": payload.get("note"),
        "category": "parts",
        "status": "PENDING",
        "requested_by": current["username"],
        "approved_by": None,
        "rejection_reason": None,
        "date": datetime.utcnow().isoformat()
    }
    await db_module.db["purchases"].insert_one(doc)

    # Notificación al DIRECTOR
    notif = {
        "id": f"NT-{int(datetime.utcnow().timestamp())}",
        "toRole": "DIRECTOR",
        "type": "PURCHASE_REQUEST",
        "purchaseId": po_id,
        "message": f"Solicitud de compra {po_id} por {current['username']} (Proveedor: {supplier})",
        "createdAt": datetime.utcnow().isoformat(),
        "read": False
    }
    await db_module.db["notifications"].insert_one(notif)
    return {"created": True, "id": po_id}

@router.patch("/{purchase_id}/decision", dependencies=[Depends(require_roles(["DIRECTOR"]))])
async def decide_purchase(purchase_id: str, decision: str, reason: Optional[str] = None, current=Depends(get_current_user)):
    if decision not in ("APPROVED","REJECTED"):
        raise HTTPException(status_code=400, detail="decision must be APPROVED or REJECTED")
    if decision == "REJECTED" and not reason:
        raise HTTPException(status_code=400, detail="reason required when rejecting")

    res = await db_module.db["purchases"].update_one(
        {"id": purchase_id},
        {"$set": {"status": decision, "approved_by": current["username"], "rejection_reason": reason or None}}
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Purchase not found")

    # Aplicar efectos si se APRUEBA: crear/actualizar parts con stock
    if decision == "APPROVED":
        po = await db_module.db["purchases"].find_one({"id": purchase_id})
        for it in po.get("items", []):
            sku = it["sku"]
            qty = int(it.get("qty", 0))
            name = it.get("name")
            part = await db_module.db["parts"].find_one({"sku": sku})
            if not part:
                # crear registro si no existe (si viene name lo guardamos)
                base = {"sku": sku, "name": name or sku, "stock": 0, "minStock": 0}
                await db_module.db["parts"].insert_one(base)
            # sumar stock
            await db_module.db["parts"].update_one({"sku": sku}, {"$inc": {"stock": qty}})

    # Notificar de vuelta al solicitante
    po = await db_module.db["purchases"].find_one({"id": purchase_id})
    if po and po.get("requested_by"):
        await db_module.db["notifications"].insert_one({
            "id": f"NT-{int(datetime.utcnow().timestamp())}",
            "toUser": po["requested_by"],
            "type": "PURCHASE_DECISION",
            "purchaseId": purchase_id,
            "message": f"Compra {purchase_id} {decision} por {current['username']}" + (f" (Motivo: {reason})" if reason else ""),
            "createdAt": datetime.utcnow().isoformat(),
            "read": False
        })
    return {"updated": True}
