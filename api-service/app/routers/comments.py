from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..models import Comment, Recipe, User
from ..schemas import CommentIn, CommentOut

router = APIRouter()


def _to_out(c: Comment) -> CommentOut:
    return CommentOut(
        id=c.id, user_id=c.user_id, username=c.user.username, body=c.body, created_at=c.created_at
    )


@router.get("/{recipe_id}/comments", response_model=list[CommentOut])
def list_comments(recipe_id: int, db: Annotated[Session, Depends(get_db)]):
    if not db.get(Recipe, recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    rows = (
        db.query(Comment).filter(Comment.recipe_id == recipe_id).order_by(desc(Comment.created_at)).all()
    )
    return [_to_out(c) for c in rows]


@router.post("/{recipe_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(
    recipe_id: int,
    data: CommentIn,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    if not db.get(Recipe, recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    c = Comment(user_id=viewer.id, recipe_id=recipe_id, body=data.body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.delete("/{recipe_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    recipe_id: int,
    comment_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    c = db.get(Comment, comment_id)
    if not c or c.recipe_id != recipe_id:
        raise HTTPException(status_code=404, detail="Not found")
    if c.user_id != viewer.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    db.delete(c)
    db.commit()
