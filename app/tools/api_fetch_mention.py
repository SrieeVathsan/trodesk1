import asyncio
from app.services.facebook_service import get_fb_mentions
from app.services.insta_service import fetch_ig_mentions
from app.services.x_services import fetch_mentions
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger as logger


async def fetch_all_mentions(db: AsyncSession):
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
                
    except Exception as e:
        logger.error(f"Error in fetch_all_mentions: {e}")