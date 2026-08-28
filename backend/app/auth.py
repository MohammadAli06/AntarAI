"""
Authentication — JWT-based auth for the AntarAI workbench.

Design (final-round hardening):
  - bcrypt password hashing
  - HS256 JWT tokens via python-jose, 8-hour expiry
  - Role is sourced from the SIGNED JWT claim (not the DB column), so a
    server-issued demo-scoped token is authoritative — a client cannot
    self-promote by editing local state because every privileged call is
    validated against the signed token by require_role()
  - DEMO_MODE (default ON for the final) gates the role-switch endpoint

The dependency get_current_user() returns a Principal (username, id, role,
demo) rather than the ORM User, so the authoritative role always comes from
the signed token.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
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

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "antar-ai-sovereign-jwt-secret-key-2026-mrpl")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8
DEMO_TOKEN_EXPIRE_HOURS = 2
DEMO_MODE = os.getenv("DEMO_MODE", "1") == "1"
VALID_ROLES = {"engineer", "approver", "admin"}

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
    )


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


# ---------------------------------------------------------------------------
# Principal — the authenticated subject (role from the signed token)
# ---------------------------------------------------------------------------

@dataclass
class Principal:
    username: str
    id: int            # the user's DB id (existing endpoints use current_user.id)
    role: str          # authoritative, from the signed JWT claim
    demo: bool = False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

class TokenPayload(BaseModel):
    sub: str          # username
    role: str
    user_id: int
    exp: Optional[datetime] = None
    demo: Optional[bool] = False


def create_access_token(username: str, role: str, user_id: int, demo: bool = False,
                        expire_hours: Optional[int] = None) -> str:
    hours = expire_hours if expire_hours is not None else (
        DEMO_TOKEN_EXPIRE_HOURS if demo else ACCESS_TOKEN_EXPIRE_HOURS
    )
    expire = datetime.utcnow() + timedelta(hours=hours)
    payload = {
        "sub": username,
        "role": role,
        "user_id": user_id,
        "exp": expire,
        "demo": demo,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_demo_token(user: User, requested_role: str) -> str:
    """Mint a short-lived, demo-scoped token carrying the requested role.

    Does NOT mutate the persisted User.role — the elevation lives only in the
    signed, short-lived token. require_role() and get_current_user() honour it.
    """
    if requested_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {requested_role}")
    return create_access_token(
        username=user.username,
        role=requested_role,
        user_id=user.id,
        demo=True,
    )


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
) -> Principal:
    """Validate the Bearer JWT and return a Principal whose role is the signed
    token's role claim (authoritative)."""
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

    return Principal(
        username=user.username,
        id=user.id,
        role=payload.role,          # authoritative — from the signed token
        demo=bool(payload.demo),
    )


def require_role(allowed_roles: list[str]):
    """Dependency generator for Role-Based Access Control.

    The role checked here is the signed-token role, so demo-scoped tokens
    are honoured server-side and client-side tampering cannot bypass it.
    """
    def role_checker(current_user: Principal = Depends(get_current_user)) -> Principal:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)} (your role: {current_user.role})",
            )
        return current_user

    return role_checker
