import hashlib
import hmac
import secrets
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuthToken, User

security = HTTPBearer(auto_error=False)

def normalize_email(email: str) -> str:
    return email.strip().lower()

def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, expected = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt).split("$", 2)[2]
    return hmac.compare_digest(candidate, expected)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def create_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token_hash=hash_token(token), user_id=user.id))
    db.commit()
    return token

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = db.query(AuthToken).filter(AuthToken.token_hash == hash_token(credentials.credentials)).first()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = db.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user
