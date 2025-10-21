from datetime import datetime, timedelta
from typing import List
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from ..core.config import settings
from ..core import db as db_module

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(sub: str, role: str, expires_minutes: int = 60) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        data = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        username = data.get("sub")
        role = data.get("role")
        if not username or not role:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db_module.db["users"].find_one({"username": username})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")

def require_roles(allowed: List[str]):
    async def checker(current=Depends(get_current_user)):
        if current["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return current
    return checker
