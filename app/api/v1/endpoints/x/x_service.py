from fastapi import APIRouter, Depends, HTTPException
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Platform
from app.services.db_services import store_mentions
from app.services.x_services import fetch_mentions, process_unreplied_mentions, reply_to_tweet

router = APIRouter(tags=["X"])


@router.get("/x/mentions")
async def get_mentions(db: AsyncSession = Depends(get_db)):
    try:
        return await fetch_mentions(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/x/reply")
async def reply_tweet(db: AsyncSession = Depends(get_db)):
    try:
        return await process_unreplied_mentions(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
