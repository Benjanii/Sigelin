from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class UserIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(pattern="^(ADMIN|TECH|DIRECTOR)$")
    email: Optional[EmailStr] = None

class UserLogin(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
