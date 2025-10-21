from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from ..core import db as db_module
from ..services.security import get_current_user, require_roles

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
async def my_notifications(current=Depends(get_current_user)):
    role = current["role"]
    username = current["username"]
    q = {"$or": [{"toRole": role}, {"toUser": username}]}
    docs = [d async for d in db_module.db["notifications"].find(q, {"_id":0}).sort("createdAt",-1).limit(50)]
    return docs

@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, current=Depends(get_current_user)):
    res = await db_module.db["notifications"].update_one({"id": notif_id}, {"$set": {"read": True}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"updated": True}
