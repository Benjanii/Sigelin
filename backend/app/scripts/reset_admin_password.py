import asyncio
from app.core.db import connect, disconnect
from app.core import db as db_module
from app.services.security import hash_password

USERNAME = "admin"
NEW_PASSWORD = "admin123"

async def main():
    await connect()
    res = await db_module.db["users"].update_one(
        {"username": USERNAME},
        {"$set": {"password": hash_password(NEW_PASSWORD)}}
    )
    if res.matched_count:
        print(f"Password de '{USERNAME}' reseteada.")
    else:
        print(f"Usuario '{USERNAME}' no existe.")
    await disconnect()

if __name__ == "__main__":
    asyncio.run(main())
