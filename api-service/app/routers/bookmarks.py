from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..models import Bookmark, Recipe, User

router = APIRouter()


@router.put("/{recipe_id}", status_code=204)
def add_bookmark(
    recipe_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    if not db.get(Recipe, recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    existing = db.query(Bookmark).filter(Bookmark.user_id == viewer.id, Bookmark.recipe_id == recipe_id).first()
    if not existing:
        db.add(Bookmark(user_id=viewer.id, recipe_id=recipe_id))
        db.commit()


@router.delete("/{recipe_id}", status_code=204)
def remove_bookmark(
    recipe_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    row = db.query(Bookmark).filter(Bookmark.user_id == viewer.id, Bookmark.recipe_id == recipe_id).first()
    if row:
        db.delete(row)
        db.commit()
