from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field
from app.models import TransactionType

class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    type: TransactionType = TransactionType.expense
    category: str = "Uncategorized"
    merchant: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    reason_photo: Optional[str] = None
    spend_kind: str = "regular"
    lent_to: Optional[str] = None
    lent_status: str = "none"
    received_mode: Optional[str] = None
    received_date: Optional[date] = None
    payment_mode: str = "account"
    is_recurring: int = 0
    recurring_name: Optional[str] = None
    investment_value: Optional[float] = Field(None, gt=0)
    import_fingerprint: Optional[str] = None
    source: str = "manual"
    transaction_date: date = Field(default_factory=date.today)

class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[TransactionType] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    reason_photo: Optional[str] = None
    spend_kind: Optional[str] = None
    lent_to: Optional[str] = None
    lent_status: Optional[str] = None
    received_mode: Optional[str] = None
    received_date: Optional[date] = None
    payment_mode: Optional[str] = None
    is_recurring: Optional[int] = None
    recurring_name: Optional[str] = None
    investment_value: Optional[float] = Field(None, gt=0)
    import_fingerprint: Optional[str] = None
    transaction_date: Optional[date] = None

class TransactionOut(TransactionCreate):
    id: int
    user_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

class UserLogin(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

class UserOut(BaseModel):
    id: int
    name: str
    email: str

    model_config = {"from_attributes": True}

class AuthOut(BaseModel):
    token: str
    user: UserOut
