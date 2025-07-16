from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.analytics_service import (
    get_sentiment_counts,
    get_ticket_stats,
    resolve_ticket
)

router = APIRouter(tags=["analytics"])

@router.get("/sentiment")
async def sentiment_analytics(
    days: int = 7,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await get_sentiment_counts(db, days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tickets")
async def ticket_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await get_ticket_stats(db, days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tickets/{mention_id}/resolve")
async def resolve_ticket_endpoint(
    mention_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await resolve_ticket(mention_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))