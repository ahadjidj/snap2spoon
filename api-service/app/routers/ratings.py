from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..models import Rating, Recipe, User
from ..schemas import RatingIn

router = APIRouter()


@router.put("/{recipe_id}/rating", status_code=204)
def upsert_rating(
    recipe_id: int,
    data: RatingIn,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    if not db.get(Recipe, recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    rating = db.query(Rating).filter(Rating.user_id == viewer.id, Rating.recipe_id == recipe_id).first()
    if rating:
        rating.score = data.score
    else:
        db.add(Rating(user_id=viewer.id, recipe_id=recipe_id, score=data.score))
    db.commit()


@router.delete("/{recipe_id}/rating", status_code=204)
def delete_rating(
    recipe_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    rating = db.query(Rating).filter(Rating.user_id == viewer.id, Rating.recipe_id == recipe_id).first()
    if rating:
        db.delete(rating)
        db.commit()
