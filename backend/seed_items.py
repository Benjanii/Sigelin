import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Carga variables de entorno desde backend/.env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB", "Sigelin")

sample_items = [
    {"code": "EQ-0001", "type": "notebook", "status": "OK",     "location": "Lab-1", "qr": "QR-EQ-0001"},
    {"code": "EQ-0002", "type": "pc",       "status": "REPAIR", "location": "Lab-2", "qr": "QR-EQ-0002"},
    {"code": "EQ-0003", "type": "printer",  "status": "LOWINK", "location": "Lab-1", "qr": "QR-EQ-0003"},
]

async def main():
    # 1) Conexión al servidor
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # 2) Limpia colección (idempotente)
    await db.items.delete_many({})

    # 3) Inserta datos de ejemplo
    await db.items.insert_many(sample_items)

    # 4) Crea índices útiles
    await db.items.create_index("code", unique=True)
    await db.items.create_index("status")
    await db.items.create_index("location")

    # 5) Cierra cliente
    client.close()
    print("Semilla OK en DB:", DB_NAME)

if __name__ == "__main__":
    asyncio.run(main())
