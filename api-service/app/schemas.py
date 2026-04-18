from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    username: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Ingredient(BaseModel):
    name: str
    quantity: str | None = None
    notes: str | None = None


class AnalyzeRequest(BaseModel):
    url: str


class AnalyzeResponse(BaseModel):
    is_recipe: bool
    reason: str | None = None
    recipe: "RecipeOut | None" = None


class RecipeCreate(BaseModel):
    source_url: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    servings: str | None = None
    prep_minutes: int | None = None
    cook_minutes: int | None = None
    ingredients: list[dict[str, Any]] = []
    steps: list[str] = []
    tags: list[str] = []
    is_public: bool = True


class RecipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int | None
    source_url: str
    title: str
    description: str | None
    thumbnail_url: str | None
    servings: str | None
    prep_minutes: int | None
    cook_minutes: int | None
    ingredients: list[Any]
    steps: list[Any]
    tags: list[Any]
    is_public: bool
    created_at: datetime
    avg_rating: float = 0.0
    rating_count: int = 0
    comment_count: int = 0
    bookmarked: bool = False


class RatingIn(BaseModel):
    score: int = Field(ge=1, le=5)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    username: str
    body: str
    created_at: datetime


class StatsOut(BaseModel):
    recipes_extracted: int
    minutes_saved: float
    hours_saved: float


AnalyzeResponse.model_rebuild()
