# app/services/analytics_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, case, desc
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

async def get_agentic_ai_analytics(db: AsyncSession, days: int = 30):
    """Get Agentic AI reply analytics using existing MentionPost table"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get reply stats from MentionPost table
    reply_query = select(
        func.count(MentionPost.id).label("total_replies"),
        func.count(func.distinct(MentionPost.user_id)).label("unique_users_replied")
    ).where(
        MentionPost.created_at.between(start_date, end_date),
        MentionPost.is_reply == True,
        MentionPost.reply_message.isnot(None)
    )
    
    result = await db.execute(reply_query)
    total_replies, unique_users = result.one()
    
    return {
        "total_ai_replies": total_replies or 0,
        "unique_users_replied": unique_users or 0,
        "time_period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }

async def get_user_reply_history(db: AsyncSession, user_id: str = None, limit: int = 10):
    """Get user's reply history using existing MentionPost table"""
    
    if user_id:
        # Reply history for specific user
        query = select(MentionPost).where(
            MentionPost.user_id == user_id,
            MentionPost.reply_message.isnot(None)
        ).order_by(desc(MentionPost.created_at)).limit(limit)
        
        result = await db.execute(query)
        posts = result.scalars().all()
        
        return {
            "user_id": user_id,
            "total_replies": len(posts),
            "reply_history": [
                {
                    "user_post": post.text,
                    "ai_reply": post.reply_message,
                    "platform": post.platform_id,
                    "sentiment": post.sentiment,
                    "created_at": post.created_at.isoformat() if post.created_at else None
                } for post in posts
            ]
        }
    else:
        # Get reply counts by platform
        platform_query = select(
            MentionPost.platform_id,
            func.count(MentionPost.id).label("count")
        ).where(
            MentionPost.reply_message.isnot(None)
        ).group_by(MentionPost.platform_id)
        
        result = await db.execute(platform_query)
        platform_stats = result.all()
        
        return {
            "platform_breakdown": {
                platform: count for platform, count in platform_stats
            },
            "total_replies": sum(count for _, count in platform_stats)
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