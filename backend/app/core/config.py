from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "Sigelin")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change_me")
    JWT_ALG: str = os.getenv("JWT_ALG", "HS256")

settings = Settings()
