import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Carga variables de entorno desde backend/.env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB", "Sigelin")

async def main():
    # Conexión al servidor
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Limpia colección items
    await db.items.delete_many({})


    #  Crea índices útiles
    await db.items.create_index("code", unique=True)
    await db.items.create_index("status")
    await db.items.create_index("location")

    # Cierra cliente
    client.close()
    print("Semilla OK en DB:", DB_NAME)

if __name__ == "__main__":
    asyncio.run(main())
