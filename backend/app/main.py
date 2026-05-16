import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.database import engine, Base
from app.routers import auth, transactions, imports 

Base.metadata.create_all(bind=engine)  # auto-create tables (replace with Alembic in prod)

def ensure_transaction_columns():
    inspector = inspect(engine)
    if not inspector.has_table("transactions"):
        return

    existing = {col["name"] for col in inspector.get_columns("transactions")}
    columns = {
        "reason": "TEXT",
        "user_id": "INTEGER",
        "reason_photo": "TEXT",
        "spend_kind": "VARCHAR(30) NOT NULL DEFAULT 'regular'",
        "lent_to": "VARCHAR(100)",
        "lent_status": "VARCHAR(30) NOT NULL DEFAULT 'none'",
        "received_mode": "VARCHAR(30)",
        "received_date": "DATE",
        "payment_mode": "VARCHAR(30) NOT NULL DEFAULT 'account'",
        "is_recurring": "INTEGER NOT NULL DEFAULT 0",
        "recurring_name": "VARCHAR(100)",
        "investment_value": "FLOAT",
        "import_fingerprint": "VARCHAR(64)",
    }
    with engine.begin() as conn:
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {name} {ddl}"))

ensure_transaction_columns()

app = FastAPI(title="Expense Tracker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(imports.router, prefix="/api") 

@app.get("/health")
def health():
    return {"status": "ok"}
