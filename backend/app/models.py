from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, ForeignKey
from app.database import Base
import enum

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(120), nullable=False)
    email           = Column(String(255), nullable=False, unique=True, index=True)
    password_hash   = Column(String(255), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id              = Column(Integer, primary_key=True, index=True)
    token_hash      = Column(String(64), nullable=False, unique=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

class TransactionType(str, enum.Enum):
    expense = "expense"
    income = "income"

class Transaction(Base):
    __tablename__ = "transactions"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    amount          = Column(Float, nullable=False)
    type            = Column(Enum(TransactionType), nullable=False, default=TransactionType.expense)
    category        = Column(String(50), nullable=False, default="Uncategorized")
    merchant        = Column(String(100), nullable=True)
    description     = Column(String(255), nullable=True)
    reason          = Column(Text, nullable=True)
    reason_photo    = Column(Text, nullable=True)
    spend_kind      = Column(String(30), nullable=False, default="regular")  # regular | lent | investment
    lent_to         = Column(String(100), nullable=True)
    lent_status     = Column(String(30), nullable=False, default="none")     # none | outstanding | received
    received_mode   = Column(String(30), nullable=True)                      # cash | account
    received_date   = Column(Date, nullable=True)
    payment_mode    = Column(String(30), nullable=False, default="account")  # account | cash
    is_recurring    = Column(Integer, nullable=False, default=0)
    recurring_name  = Column(String(100), nullable=True)
    investment_value = Column(Float, nullable=True)
    import_fingerprint = Column(String(64), nullable=True, index=True)
    source          = Column(String(50), nullable=False, default="manual")  # manual | csv | nlp
    transaction_date = Column(Date, nullable=False, default=date.today)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
