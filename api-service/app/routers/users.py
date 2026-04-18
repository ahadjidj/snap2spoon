from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import create_access_token, current_user, hash_password, verify_password
from ..database import get_db
from ..models import User
from ..schemas import Token, UserCreate, UserLogin, UserOut

router = APIRouter()


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
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]):
    return user
