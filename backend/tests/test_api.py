# --- asegurar que 'backend' esté en sys.path ---
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]  # .../backend
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
# ----------------------------------------------

import pytest
from httpx import AsyncClient, ASGITransport
from asgi_lifespan import LifespanManager

from app.main import app

@pytest.mark.asyncio
async def test_health():
    # LifespanManager ejecuta startup/shutdown de FastAPI
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.get("/health")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_inventory_list_ok():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.get("/inventory/")
            assert r.status_code == 200
            assert isinstance(r.json(), list)
