from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Stat
from ..schemas import StatsOut

router = APIRouter()


@router.get("", response_model=StatsOut)
def get_stats(db: Annotated[Session, Depends(get_db)]):
    stat = db.get(Stat, 1)
    minutes = stat.minutes_saved if stat else 0.0
    return StatsOut(
        recipes_extracted=stat.recipes_extracted if stat else 0,
        minutes_saved=minutes,
        hours_saved=round(minutes / 60.0, 1),
    )
