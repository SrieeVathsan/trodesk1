import asyncio
from app.services.db_services import get_unreplied_mentions
from app.services.facebook_service import get_fb_mentions
from app.services.insta_service import fetch_ig_mentions
from app.services.x_services import fetch_mentions
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger as logger


async def fetch_mentions_and_unreplied_mentions(db: AsyncSession):
    """Fetch mentions from all platforms and store in database."""
    try:
        # Fetch from all platforms
        tasks = [
            get_fb_mentions(db),
            fetch_ig_mentions(db),
            fetch_mentions(db)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log results
        platforms = ["Facebook", "Instagram", "X"]
        for i, (platform, result) in enumerate(zip(platforms, results)):
            if isinstance(result, Exception):
                logger.error(f"Error fetching {platform} mentions: {result}")
            else:
                # message state yet to update
                logger.info(f"Successfully fetched {platform} mentions")
       
        # Get all unreplied mentions
        mentions = await get_unreplied_mentions(db)
        
        if not mentions:
            logger.info("No unreplied mentions found")
            return {"status": "no_unreplied_mentions", "processed": 0, "mentions": []}

        # Format the mentions data for the agent
        formatted_mentions = []
        for mention in mentions:
            formatted_mentions.append({
                "id": mention.id,
                "platform": mention.platform_id,
                "text": mention.text,
                "user_id": mention.user_id,
                "created_at": str(mention.created_at),
                "sentiment": mention.sentiment if hasattr(mention, 'sentiment') else None
            })
        
        logger.info(f"Found {len(formatted_mentions)} unreplied mentions")
        return {
            "status": "success", 
            "total_mentions": len(formatted_mentions),
            "mentions": formatted_mentions
        }
    
                
    except Exception as e:
        logger.error(f"Error in fetch_all_mentions: {e}")
        return {"status": "error", "message": str(e), "mentions": []}