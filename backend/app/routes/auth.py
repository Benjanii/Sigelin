from fastapi import APIRouter, HTTPException, Depends
from ..models.user import UserIn, UserLogin, TokenOut
from ..services.security import hash_password, verify_password, create_access_token, get_current_user
from ..core import db as db_module

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register_user(payload: UserIn):
    exists = await db_module.db["users"].find_one({"username": payload.username})
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")
    doc = payload.dict()
    doc["password"] = hash_password(doc["password"])
    await db_module.db["users"].insert_one(doc)
    return {"created": True, "username": payload.username}

@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin):
    user = await db_module.db["users"].find_one({"username": payload.username})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(sub=user["username"], role=user["role"])
    return {"access_token": token}

@router.get("/me")
async def me(current=Depends(get_current_user)):
    return current
