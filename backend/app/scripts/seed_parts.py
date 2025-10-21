import asyncio
from app.core.db import connect, disconnect
from app.core import db as db_module

async def main():
    await connect()
    parts = [
        {"sku":"P-SSD-240", "name":"SSD 240GB", "stock": 2, "minStock": 3},
        {"sku":"P-RAM-8GB", "name":"RAM 8GB",   "stock": 10, "minStock": 5},
        {"sku":"P-TONER-05","name":"Toner 05",  "stock": 1, "minStock": 2}
    ]
    for p in parts:
        await db_module.db["parts"].update_one({"sku": p["sku"]}, {"$set": p}, upsert=True)
    print("Seed parts OK")
    await disconnect()

if __name__ == "__main__":
    asyncio.run(main())
