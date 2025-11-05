# backend/app/routes/inventory.py
from fastapi import APIRouter, HTTPException, Depends
from ..core import db as db_module
from ..services.security import require_roles

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/")
async def list_items():
    items = [doc async for doc in db_module.db["items"].find({}, {"_id":0}).limit(200)]
    return items

#Inventario SOLO LECTURA (gestión via DB o compras) ===
@router.post("/", dependencies=[Depends(require_roles(["ADMIN"]))])
async def add_item():
    raise HTTPException(status_code=403, detail="inventory_mutations_disabled_db_managed")


@router.patch("/{code}", dependencies=[Depends(require_roles(["ADMIN"]))])
async def update_item():
    raise HTTPException(status_code=403, detail="inventory_mutations_disabled_db_managed")

@router.delete("/{code}", dependencies=[Depends(require_roles(["ADMIN"]))])
async def delete_item():
    raise HTTPException(status_code=403, detail="inventory_mutations_disabled_db_managed")

