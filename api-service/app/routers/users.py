import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import create_access_token, current_user, hash_password, verify_password
from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import GoogleLogin, Token, UserCreate, UserLogin, UserOut

router = APIRouter()


def _unique_username(db: Session, base: str) -> str:
    base = re.sub(r"[^a-z0-9_]+", "", base.lower()) or "cook"
    base = base[:56]
    candidate = base
    i = 1
    while db.query(User).filter(User.username == candidate).first():
        suffix = str(i)
        candidate = f"{base[: 63 - len(suffix)]}{suffix}"
        i += 1
    return candidate


@router.post("/signup", response_model=Token, status_code=201)
def signup(data: UserCreate, db: Annotated[Session, Depends(get_db)]):
    existing = db.query(User).filter(or_(User.email == data.email, User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email or username already taken")
    user = User(email=data.email, username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.post("/google", response_model=Token)
def google_login(data: GoogleLogin, db: Annotated[Session, Depends(get_db)]):
    """Exchange a Google ID token (from Google Identity Services on the client)
    for a snap2spoon JWT. Creates the account on first use."""
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        claims = google_id_token.verify_oauth2_token(
            data.id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}") from exc

    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    google_sub = claims["sub"]
    email = claims["email"].lower()
    name = claims.get("name") or email.split("@")[0]
    picture = claims.get("picture")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = google_sub
            if picture and not user.avatar_url:
                user.avatar_url = picture
        else:
            user = User(
                email=email,
                username=_unique_username(db, name),
                google_sub=google_sub,
                avatar_url=picture,
                password_hash=None,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]):
    return user
