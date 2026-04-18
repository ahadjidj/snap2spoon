from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Stat
from .routers import bookmarks, comments, ratings, recipes, stats, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.get(Stat, 1) is None:
            db.add(Stat(id=1, recipes_extracted=0, minutes_saved=0.0))
            db.commit()
    yield


app = FastAPI(title="snap2spoon API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(ratings.router, prefix="/recipes", tags=["ratings"])
app.include_router(comments.router, prefix="/recipes", tags=["comments"])
app.include_router(bookmarks.router, prefix="/bookmarks", tags=["bookmarks"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])


@app.get("/health")
def health():
    return {"status": "ok"}
