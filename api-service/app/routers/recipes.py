from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..auth import current_user, optional_user
from ..config import settings
from ..database import get_db
from ..models import Bookmark, Comment, Rating, Recipe, Stat, User
from ..schemas import AnalyzeRequest, AnalyzeResponse, RecipeCreate, RecipeOut

router = APIRouter()


def _enrich(db: Session, recipe: Recipe, viewer: User | None) -> RecipeOut:
    avg, count = db.query(func.avg(Rating.score), func.count(Rating.id)).filter(Rating.recipe_id == recipe.id).one()
    comment_count = db.query(func.count(Comment.id)).filter(Comment.recipe_id == recipe.id).scalar() or 0
    bookmarked = False
    if viewer:
        bookmarked = (
            db.query(Bookmark).filter(Bookmark.recipe_id == recipe.id, Bookmark.user_id == viewer.id).first() is not None
        )
    out = RecipeOut.model_validate(recipe)
    out.avg_rating = float(avg or 0.0)
    out.rating_count = int(count or 0)
    out.comment_count = int(comment_count)
    out.bookmarked = bookmarked
    return out


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    req: AnalyzeRequest,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User | None, Depends(optional_user)],
):
    """Call analyzer-service. If it's a recipe, persist it and bump the time-saved counter."""
    try:
        resp = httpx.post(f"{settings.analyzer_url}/analyze", json={"url": req.url}, timeout=180.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Analyzer failed: {exc}") from exc

    data = resp.json()
    if not data.get("is_recipe"):
        return AnalyzeResponse(is_recipe=False, reason=data.get("reason") or "No recipe detected in this video.")

    payload = data["recipe"]
    recipe = Recipe(
        owner_id=viewer.id if viewer else None,
        source_url=req.url,
        title=payload.get("title", "Untitled recipe"),
        description=payload.get("description"),
        thumbnail_url=payload.get("thumbnail_url"),
        servings=payload.get("servings"),
        prep_minutes=payload.get("prep_minutes"),
        cook_minutes=payload.get("cook_minutes"),
        ingredients=payload.get("ingredients", []),
        steps=payload.get("steps", []),
        tags=payload.get("tags", []),
        is_public=True,
    )
    db.add(recipe)

    stat = db.get(Stat, 1)
    if stat is None:
        stat = Stat(id=1)
        db.add(stat)
    stat.recipes_extracted += 1
    stat.minutes_saved += settings.minutes_saved_per_recipe

    db.commit()
    db.refresh(recipe)
    return AnalyzeResponse(is_recipe=True, recipe=_enrich(db, recipe, viewer))


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User | None, Depends(optional_user)],
    q: str | None = None,
    mine: bool = False,
    bookmarked: bool = False,
    sort: str = Query("date_desc", pattern="^(date_desc|date_asc|rating)$"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    avg_sub = (
        db.query(Rating.recipe_id, func.avg(Rating.score).label("avg_rating"))
        .group_by(Rating.recipe_id)
        .subquery()
    )
    query = db.query(Recipe).outerjoin(avg_sub, avg_sub.c.recipe_id == Recipe.id)
    if mine:
        if not viewer:
            raise HTTPException(status_code=401, detail="Login required")
        query = query.filter(Recipe.owner_id == viewer.id)
    else:
        query = query.filter(Recipe.is_public.is_(True))
    if bookmarked:
        if not viewer:
            raise HTTPException(status_code=401, detail="Login required")
        query = query.join(Bookmark, Bookmark.recipe_id == Recipe.id).filter(Bookmark.user_id == viewer.id)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(func.lower(Recipe.title).like(like))
    if sort == "rating":
        query = query.order_by(desc(func.coalesce(avg_sub.c.avg_rating, 0)))
    elif sort == "date_asc":
        query = query.order_by(Recipe.created_at)
    else:
        query = query.order_by(desc(Recipe.created_at))
    recipes = query.offset(offset).limit(limit).all()
    return [_enrich(db, r, viewer) for r in recipes]


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User | None, Depends(optional_user)],
):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Not found")
    return _enrich(db, recipe, viewer)


@router.post("", response_model=RecipeOut, status_code=201)
def create_manual(
    data: RecipeCreate,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    recipe = Recipe(owner_id=viewer.id, **data.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return _enrich(db, recipe, viewer)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User, Depends(current_user)],
):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Not found")
    if recipe.owner_id != viewer.id:
        raise HTTPException(status_code=403, detail="Not your recipe")
    db.delete(recipe)
    db.commit()
