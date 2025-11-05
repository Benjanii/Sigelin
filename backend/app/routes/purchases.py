# backend/app/routes/purchases.py
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..core import db as db_module
from ..services.security import require_roles, get_current_user

router = APIRouter(prefix="/purchases", tags=["purchases"])

def now_iso() -> str:
    return datetime.utcnow().isoformat()

def gen_equipment_code() -> str:
    return f"EQ-{int(datetime.utcnow().timestamp())}"

def gen_qr_for(code: str) -> str:
    return f"QR-{code}"

@router.get("/")
async def list_purchases(status: Optional[str] = Query(None), limit: int = 200):
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    cur = db_module.db["purchases"].find(q, {"_id": 0}).sort("createdAt", -1).limit(limit)
    return [doc async for doc in cur]

@router.post("/", dependencies=[Depends(require_roles(["ADMIN"]))])
async def create_purchase(payload: dict, current=Depends(get_current_user)):
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="items is required and must be a non-empty list")

    po_id = f"PO-{int(datetime.utcnow().timestamp())}"
    doc = {
        "id": po_id,
        "supplier": payload.get("supplier") or "",
        "note": payload.get("note") or "",
        "category": payload.get("category") or "mixed",
        "items": items,
        "requested_by": current.get("username"),
        "status": "PENDING",
        "createdAt": now_iso(),
    }
    await db_module.db["purchases"].insert_one(doc)
    return {"created": True, "id": po_id}

@router.post("/{po_id}/approve", dependencies=[Depends(require_roles(["DIRECTOR"]))])
async def approve_purchase(po_id: str, body: dict, current=Depends(get_current_user)):
    """
    body: { approve: bool, reason?: str }
    Si approve=True => materializa:
      - PARTS: actualiza o inserta repuesto (stock += qty)
      - INVENTORY: inserta equipo en 'items' con QR autogenerado si falta y respeta 'new_product.name'
    """
    po = await db_module.db["purchases"].find_one({"id": po_id})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if po.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail=f"Purchase already decided: {po.get('status')}")

    approve = bool(body.get("approve"))
    reason = body.get("reason") or ""

    if not approve:
        await db_module.db["purchases"].update_one(
            {"id": po_id},
            {"$set": {
                "status": "REJECTED",
                "decision_reason": reason,
                "decided_by": current.get("username"),
                "decidedAt": now_iso()
            }}
        )
        return {"approved": False, "id": po_id, "reason": reason}

    # === MATERIALIZACIÓN ===
    items = po.get("items") or []
    for it in items:
        destination = (it.get("destination") or "").upper()
        is_new = bool(it.get("is_new_product"))
        qty = it.get("qty")
        if qty is None:  # compat
            qty = it.get("quantity")
        try:
            qty = int(qty or 0)
        except Exception:
            qty = 0
        unit_price = it.get("unit_price") or 0

        if destination == "PARTS":
            if is_new:
                # Inserta (o upsert) repuesto
                np = it.get("new_product") or {}
                sku = (np.get("sku") or it.get("sku") or "").strip()
                name = (np.get("name") or sku or "Repuesto").strip()
                if not sku:
                    # genera un SKU simple si no vino
                    sku = f"SKU-{int(datetime.utcnow().timestamp())}"
                existing = await db_module.db["parts"].find_one({"sku": sku})
                if existing:
                    await db_module.db["parts"].update_one(
                        {"sku": sku},
                        {"$inc": {"stock": qty}, "$setOnInsert": {"name": name}}
                    )
                else:
                    await db_module.db["parts"].insert_one({
                        "sku": sku,
                        "name": name,
                        "description": np.get("description") or "",
                        "stock": int(qty or 0),
                        "minStock": 0,
                        "createdAt": now_iso(),
                    })
            else:
                # PARTS existente: aumentar stock por sku
                sku = (it.get("sku") or "").strip()
                if not sku:
                    continue
                exists = await db_module.db["parts"].find_one({"sku": sku})
                if exists:
                    await db_module.db["parts"].update_one({"sku": sku}, {"$inc": {"stock": qty}})
                else:
                    # si no existe, lo creamos con nombre=sku
                    await db_module.db["parts"].insert_one({
                        "sku": sku,
                        "name": sku,
                        "description": "",
                        "stock": int(qty or 0),
                        "minStock": 0,
                        "createdAt": now_iso(),
                    })

        elif destination == "INVENTORY":
            np = it.get("new_product") or {}
            name = (np.get("name") or "").strip()
            typ = (np.get("type") or "equipo").strip()
            status = (np.get("status") or "BUENO").strip()
            location = (np.get("location") or "Bodega").strip()
            code = (np.get("code") or "").strip()
            qr = (np.get("qr") or "").strip()

            n = max(1, int(qty or 1))
            for _ in range(n):
                eq_code = code or gen_equipment_code()
                eq_qr = qr or gen_qr_for(eq_code)

                final_name = name if name else f"{typ.capitalize()} {eq_code}"  
                doc = {
                    "code": eq_code,
                    "qr": eq_qr,
                    "name": final_name,                                         
                    "type": typ,
                    "status": status,
                    "location": location,
                    "unit_price": unit_price,
                    "createdAt": now_iso(),
                }
                await db_module.db["items"].insert_one(doc)

        else:
            # Destino desconocido → omitir sin romper
            continue

    # Marcar compra como aprobada
    await db_module.db["purchases"].update_one(
        {"id": po_id},
        {"$set": {
            "status": "APPROVED",
            "decided_by": current.get("username"),
            "decidedAt": now_iso()
        }}
    )
    return {"approved": True, "id": po_id}
