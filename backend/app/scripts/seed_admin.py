import asyncio
from app.core.db import connect, disconnect
from app.services.security import hash_password
from app.core import db as db_module

async def main():
    await connect()
    user = await db_module.db["users"].find_one({"username":"admin"})
    if not user:
        await db_module.db["users"].insert_one({
            "username":"admin",
            "password": hash_password("admin123"),
            "role":"ADMIN",
            "email":"admin@example.com"
        })
        print("Admin creado: admin / admin123")
    else:
        print("Admin ya existe")
    await disconnect()

if __name__ == "__main__":
    asyncio.run(main())
