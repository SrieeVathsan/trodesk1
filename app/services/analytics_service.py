# app/services/analytics_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, case
from datetime import datetime, timedelta
from app.models.models import MentionPost

async def get_sentiment_counts(db: AsyncSession, days: int = 7):
    """Get sentiment analysis counts (positive/negative) for mentions"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    sentiment_query = select(
        MentionPost.sentiment,
        func.count(MentionPost.id).label("count")
    ).where(
        MentionPost.created_at.between(start_date, end_date),
        MentionPost.sentiment.isnot(None)
    ).group_by(MentionPost.sentiment)
    
    result = await db.execute(sentiment_query)
    sentiment_counts = result.all()
    
    analytics = {
        "positive": 0,
        "negative": 0,
        "total": 0,
        "time_period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }
    
    for sentiment, count in sentiment_counts:
        if sentiment.lower() == "positive":
            analytics["positive"] = count
        elif sentiment.lower() == "negative":
            analytics["negative"] = count
        analytics["total"] += count
    
    return analytics

async def get_ticket_stats(db: AsyncSession, days: int = 30):
    """Get ticket status analytics (resolved/pending)"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    ticket_query = select(
        func.count(MentionPost.id).label("total"),
        func.sum(case((MentionPost.Ticket_resolved == True, 1), else_=0)).label("resolved"),
        func.sum(case((MentionPost.Ticket_resolved == False, 1), else_=0)).label("pending")
    ).where(
        MentionPost.created_at.between(start_date, end_date),
        MentionPost.sentiment == "negative"
    )
    
    result = await db.execute(ticket_query)
    total, resolved, pending = result.one()
    
    return {
        "total_tickets": total or 0,
        "resolved": resolved or 0,
        "pending": pending or 0,
        "resolution_rate": (resolved / total * 100) if total else 0,
        "time_period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }

async def resolve_ticket(mention_id: str, db: AsyncSession):
    """Mark a mention as resolved"""
    mention_result = await db.execute(select(MentionPost).where(MentionPost.id==mention_id))
    mention=mention_result.scalar_one_or_none()
    print("mentuon:-----------------",mention)
    if not mention:
        return {"error": "Mention not found"}
    
    if mention.sentiment != "negative":
        return {"error": "Only negative sentiment mentions can be resolved"}
    
    mention.Ticket_resolved = True
    await db.commit()
    
    return {
        "success": True,
        "message": f"Mention {mention_id} marked as resolved",
        "ticket_status": "resolved"
    }