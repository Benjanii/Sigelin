from fastapi import APIRouter, Depends, HTTPException
from ..core import db as db_module
from ..services.security import require_roles
from datetime import datetime, timedelta

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/overview")
def get_overview(db=Depends(lambda: db_module.db), user=Depends(require_roles(["ADMIN","DIRECTOR","TECH"]))):
    try:
        items_col = db["items"]
        repairs_col = db["repairs"]
        purchases_col = db["purchases"]

        now = datetime.utcnow()
        since = now - timedelta(days=14)

        total_items = items_col.count_documents({})
        repairs_by_state = {}
        for st in ["EN_REPARACION","MALO"]:
            repairs_by_state[st] = repairs_col.count_documents({"state": st})

        pending_purchases = purchases_col.count_documents({"status": "PENDING"})

        recent_repairs = repairs_col.count_documents({"created_at": {"$gte": since}})
        recent_purchases = purchases_col.count_documents({"created_at": {"$gte": since}})

        payload = {
            "inventory": {"total": total_items},
            "repairs": {"by_state": repairs_by_state, "last14d": recent_repairs},
            "purchases": {"pending": pending_purchases, "last14d": recent_purchases},
            "generated_at": now.isoformat() + "Z"
        }
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"overview_error: {e}")
from fastapi import APIRouter
from ..core import db as db_module

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/overview")
async def reports_overview():
    # 1) Items por status
    pipeline_items = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$project": {"status": "$_id", "count": 1, "_id": 0}}
    ]
    items_status = [d async for d in db_module.db["items"].aggregate(pipeline_items)]

    # 2) Repuestos en stock crítico (stock < minStock)
    low_stock = [p async for p in db_module.db["parts"].find(
        {"$expr": {"$lt": ["$stock", "$minStock"]}}, {"_id":0, "sku":1, "name":1, "stock":1, "minStock":1}
    ).limit(50)]

    # 3) Reparaciones por mes (últimos 6 meses)
    pipeline_repairs = [
        {"$addFields": {"_ym": {"$substr": ["$date", 0, 7]}}},  # asume date ISO string
        {"$group": {"_id": "$_ym", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 6},
        {"$project": {"month": "$_id", "count": 1, "_id": 0}},
        {"$sort": {"month": 1}}
    ]
    repairs_by_month = [d async for d in db_module.db["repairs"].aggregate(pipeline_repairs)]

    return {
        "items_by_status": items_status,
        "parts_low_stock": low_stock,
        "repairs_by_month": repairs_by_month
    }
