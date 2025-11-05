# backend/app/routes/printers.py
from fastapi import APIRouter, HTTPException
from ..core import db as db_module

router = APIRouter(prefix="/printers", tags=["printers"])

async def _load_printer_states() -> list[str]:
    """
    Lee estados válidos de la colección 'printer_states' (solo { value }).
    Devuelve valores en mayúsculas y únicos.
    """
    cur = db_module.db["printer_states"].find({}, {"_id": 0, "value": 1})
    values = [ (doc.get("value") or "").strip().upper() async for doc in cur ]
    values = sorted(set([v for v in values if v]))
    if not values:
        raise HTTPException(status_code=500, detail="No hay estados en 'printer_states'.")
    return values

@router.get("/states")
async def list_printer_states():
    """Ej: ["OK","LOW"] — tomado de la colección printer_states."""
    return await _load_printer_states()

@router.get("/low-ink")
async def list_printers_low_ink():
    """
    Lista impresoras con estado 'LOW' (según printer_states).
    IDENTIFICACIÓN: items.name === 'printer' (case-insensitive).
    """
    states = await _load_printer_states()
    if "LOW" not in states:
        # si la colección no define LOW, devolvemos vacío para ser estrictos
        return []

    q = {
        # <-- aquí el cambio importante: usamos 'name' y no 'type'
        "name": { "$regex": "^printer$", "$options": "i" },
        "status": "LOW",
    }
    fields = { "_id": 0, "code": 1, "name": 1, "status": 1, "qr": 1, "location": 1 }
    docs = [d async for d in db_module.db["items"].find(q, fields).limit(500)]
    return docs
