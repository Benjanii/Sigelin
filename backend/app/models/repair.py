from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PartUse(BaseModel):
    sku: str
    qty: int = Field(gt=0)

class RepairIn(BaseModel):
    equipmentCode: str
    qr: Optional[str] = None
    description: str
    partsUsed: List[PartUse] = []
    softwareChanges: Optional[str] = None
    hardwareChanges: Optional[str] = None
    status: str = Field(pattern="^(OPEN|IN_PROGRESS|CLOSED)$")
    technician: str

class RepairOut(RepairIn):
    id: Optional[str]
    created_by: Optional[str]
    date: Optional[str]
