# backend/app/routes/locations.py
from fastapi import APIRouter
from typing import Any
from ..core import db as db_module

router = APIRouter(prefix="/locations", tags=["locations"])

POSSIBLE_COLLECTIONS = ["Location", "location", "locations"]

def _pick_name(doc: dict[str, Any]) -> str | None:
    """
    Intenta extraer un nombre legible de distintas formas de documento:
    - {"name":"Lab-01"} / {"nombre":"Lab-01"} / {"label":"Lab-01"} / {"value":"Lab-01"} / {"code":"Lab-01"}
    - {"name": {"es":"Lab-01"}} -> toma el primer string
    """
    for k in ("name", "Name", "nombre", "label", "value", "code", "id"):
        if k in doc and doc[k]:
            v = doc[k]
            if isinstance(v, str):
                return v.strip()
            if isinstance(v, dict):
                # toma el primer valor string
                for vv in v.values():
                    if isinstance(vv, str) and vv.strip():
                        return vv.strip()
    return None

@router.get("/")
async def list_locations():
    names: set[str] = set()
    # 1) intenta colecciones comunes documento-a-documento
    for coll in POSSIBLE_COLLECTIONS:
        if coll not in (await db_module.db.list_collection_names()):
            continue
        async for d in db_module.db[coll].find({}, {"_id": 0}):
            n = _pick_name(d)
            if n:
                names.add(n)

    # 2) fallback: colecciones con un doc que contiene arreglo, ej: {"locations":["Lab-01","Lab-02",...]}
    if not names:
        for coll in POSSIBLE_COLLECTIONS:
            if coll not in (await db_module.db.list_collection_names()):
                continue
            doc = await db_module.db[coll].find_one({}, {"_id": 0})
            if isinstance(doc, dict):
                for key in ("locations", "ubicaciones", "values", "items"):
                    arr = doc.get(key)
                    if isinstance(arr, list):
                        for v in arr:
                            if isinstance(v, str) and v.strip():
                                names.add(v.strip())

    # Orden alfabético y respuesta uniforme
    return [{"name": n} for n in sorted(names)]
