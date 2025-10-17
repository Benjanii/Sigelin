import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "Sigelin"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    # ping
    pong = await db.command("ping")
    print("Ping:", pong)

    # listar colecciones
    cols = await db.list_collection_names()
    print("Colecciones:", cols)

    # leer algunos items
    cursor = db["items"].find({}, {"_id": 0}).limit(5)
    docs = await cursor.to_list(None)
    print("Items (5):", docs)

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
