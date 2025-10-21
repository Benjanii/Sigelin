from fastapi import APIRouter, Depends
from ..core import db as db_module
from ..services.security import require_roles

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", dependencies=[Depends(require_roles(["ADMIN"]))])
async def list_users():
    users = [ {"username":u.get("username"), "role":u.get("role"), "email":u.get("email")}
              async for u in db_module.db["users"].find({}, {"_id":0, "username":1, "role":1, "email":1}) ]
    return users
