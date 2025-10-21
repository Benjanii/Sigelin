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
