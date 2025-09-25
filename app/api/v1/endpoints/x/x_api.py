from fastapi import APIRouter, Depends, HTTPException
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Platform
from app.services.db_services import store_mentions
from app.services.x_services import fetch_mentions
from app.services.x_services import reply_to_tweet
from app.core.logger import app_logger


router = APIRouter(tags=["X"])


@router.get("/x/mentions")
async def get_mentions(db: AsyncSession = Depends(get_db)):
    try:
        return await fetch_mentions(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/x/reply")
async def reply_tweet(tweet_id: str, comment_text: str, db: AsyncSession = Depends(get_db)):
    try:
        return await reply_to_tweet(db, tweet_id, comment_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
