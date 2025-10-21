import asyncio
from app.core.db import connect, disconnect
from app.core import db as db_module
from app.services.security import hash_password

async def main():
    await connect()
    coll = db_module.db["users"]
    updated = 0

    # Recorre todos los usuarios
    async for u in coll.find({}):
        pwd = u.get("password")
        if not pwd:
            continue
        # Si NO es bcrypt (no empieza con $2...), lo hasheamos
        if not str(pwd).startswith("$2"):
            new_hash = hash_password(str(pwd))
            await coll.update_one({"_id": u["_id"]}, {"$set": {"password": new_hash}})
            updated += 1

    print(f"Usuarios actualizados a bcrypt: {updated}")
    await disconnect()

if __name__ == "__main__":
    asyncio.run(main())
