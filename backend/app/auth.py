"""
Authentication — JWT-based auth for the AntarAI workbench.

Design choices (hackathon-grade):
  • bcrypt password hashing via passlib
  • HS256 JWT tokens via python-jose
  • 8-hour token expiry, no refresh tokens
  • Single get_current_user() dependency protects all sensitive routes
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import User, get_db

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# In production: read from env / secrets vault — never hardcode
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "antar-ai-sovereign-jwt-secret-key-2026-mrpl")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

# ---------------------------------------------------------------------------
# Password hashing (Direct bcrypt usage)
# ---------------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    )


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# In production: read from env / secrets vault — never hardcode
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "antar-ai-sovereign-jwt-secret-key-2026-mrpl")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

# ---------------------------------------------------------------------------
# Password hashing (Direct bcrypt to avoid passlib+bcrypt 4.x version bug)
# ---------------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    )


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")



# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

class TokenPayload(BaseModel):
    sub: str          # username
    role: str
    user_id: int
    exp: Optional[datetime] = None


def create_access_token(username: str, role: str, user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "role": role,
        "user_id": user_id,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**data)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# Dependency — protects all sensitive routes
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency.  Validates the Bearer JWT and returns the User ORM object.
    Attach with:   current_user: User = Depends(get_current_user)
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user = db.query(User).filter(User.username == payload.sub).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(allowed_roles: list[str]):
    """
    Dependency generator for Role-Based Access Control (RBAC).

    Usage:
        @app.get("/admin-only", dependencies=[Depends(require_role(["admin"]))])
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)} (your role: {current_user.role})",
            )
        return current_user

    return role_checker

