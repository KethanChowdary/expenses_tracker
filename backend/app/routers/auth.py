from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.auth import create_token, get_current_user, hash_password, hash_token, normalize_email, verify_password
from app.database import get_db
from app.models import AuthToken, Transaction, User
from app.schemas import AuthOut, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

@router.post("/register", response_model=AuthOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Local-app migration helper: first user claims old unowned transactions.
    if db.query(User).count() == 1:
        db.query(Transaction).filter(Transaction.user_id.is_(None)).update({Transaction.user_id: user.id})
        db.commit()

    token = create_token(db, user)
    return {"token": token, "user": user}

@router.post("/login", response_model=AuthOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(db, user)
    return {"token": token, "user": user}

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@router.post("/logout", status_code=204)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials and credentials.scheme.lower() == "bearer":
        db.query(AuthToken).filter(AuthToken.token_hash == hash_token(credentials.credentials)).delete()
        db.commit()
