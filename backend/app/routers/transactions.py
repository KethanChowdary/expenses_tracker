from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from app.database import get_db
from app.auth import get_current_user
from app.models import Transaction, User
from app.schemas import TransactionCreate, TransactionUpdate, TransactionOut
import sqlalchemy as sa

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionOut])
def list_transactions(
    skip: int = 0,
    limit: int = Query(200, le=1000),
    type: Optional[str] = None,
    category: Optional[str] = None,
    spend_kind: Optional[str] = None,
    payment_mode: Optional[str] = None,
    date_from: Optional[date] = None,   # inclusive start date
    date_to: Optional[date] = None,     # inclusive end date
    order: str = "desc",                # "asc" | "desc"
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(Transaction.user_id == user.id)

    if type:
        q = q.filter(Transaction.type == type)
    if category:
        q = q.filter(Transaction.category == category)
    if spend_kind:
        q = q.filter(Transaction.spend_kind == spend_kind)
    if payment_mode:
        q = q.filter(Transaction.payment_mode == payment_mode)
    if date_from:
        q = q.filter(Transaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(Transaction.transaction_date <= date_to)

    if order == "asc":
        q = q.order_by(
            Transaction.transaction_date.asc(),
            Transaction.created_at.asc(),
            Transaction.id.asc(),
        )
    else:
        q = q.order_by(
            Transaction.transaction_date.desc(),
            Transaction.created_at.desc(),
            Transaction.id.desc(),
        )

    return q.offset(skip).limit(limit).all()


@router.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = Transaction(**payload.model_dump(), user_id=user.id)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.get("/{tx_id}", response_model=TransactionOut)
def get_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = db.get(Transaction, tx_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(404, "Transaction not found")
    return tx


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = db.get(Transaction, tx_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(404, "Transaction not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tx, k, v)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = db.get(Transaction, tx_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(404, "Transaction not found")
    db.delete(tx)
    db.commit()
