import asyncio
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import MentionPost
from app.services.facebook_service import get_fb_mentions
from app.services.insta_service import fetch_ig_mentions
from app.services.x_services import fetch_mentions
from app.core.logger import app_logger as logger

class AutonomousAgenticService:
    """Autonomous Agentic AI service that runs every 60 seconds"""
    def __init__(self):
        self.is_running = False
        
    async def fetch_all_mentions(self, db: AsyncSession):
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
                    logger.info(f"Successfully fetched {platform} mentions")
                    
        except Exception as e:
            logger.error(f"Error in fetch_all_mentions: {e}")

    async def process_unreplied_mentions(self, db: AsyncSession):
        """Process all unreplied mentions across all platforms."""
        try:
            # Get all unreplied mentions
            from app.services.db_services import get_unreplied_mentions
            mentions = await get_unreplied_mentions(db)
            
            if not mentions:
                logger.info("No unreplied mentions found")
                return {"status": "no_unreplied_mentions", "processed": 0}

            processed_count = 0
            failed_count = 0
            
            for mention in mentions:
                try:
                    # Process each mention with Agentic AI
                    from app.utils.agentic_ai import agentic_llm_call
                    result = await agentic_llm_call(db, mention)
                    processed_count += 1
                    quality_score = result.get('quality_score', 0.5)
                    logger.info(f"🤖 Agentic AI processed mention {mention.id} from {mention.platform_id} - Quality: {quality_score}")
                    
                except Exception as e:
                    failed_count += 1
                    logger.error(f"❌ Agentic AI failed to process mention {mention.id}: {e}")
            
            logger.info(f"Processed {processed_count} mentions, {failed_count} failed")
            return {
                "status": "completed",
                "processed": processed_count,
                "failed": failed_count
            }
            
        except Exception as e:
            logger.error(f"Error in process_unreplied_mentions: {e}")
            return {"status": "error", "error": str(e)}

    async def autonomous_cycle(self):
        """Single autonomous cycle - fetch and process mentions."""
        try:
            # Get database session
            from app.db.session import async_session
            async with async_session() as db:
                logger.info("🚀 Starting autonomous Agentic AI cycle")
                
                # Step 1: Fetch all mentions
                await self.fetch_all_mentions(db)
                
                # Step 2: Process unreplied mentions
                result = await self.process_unreplied_mentions(db)
                
                logger.info(f"✅ Agentic AI cycle completed: {result}")
                
        except Exception as e:
            logger.error(f"❌ Error in autonomous Agentic AI cycle: {e}")

    async def start_autonomous_service(self):
        """Start the autonomous Agentic AI service that runs every 60 seconds."""
        self.is_running = True
        logger.info("🤖 Starting autonomous Agentic AI service (60-second intervals)")
        
        while self.is_running:
            try:
                await self.autonomous_cycle()
                
                # Wait 60 seconds before next cycle
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"❌ Error in autonomous Agentic AI service: {e}")
                # Wait 60 seconds even if there's an error
                await asyncio.sleep(60)

    def stop_autonomous_service(self):
        """Stop the autonomous Agentic AI service."""
        self.is_running = False
        logger.info("🤖 Autonomous Agentic AI service stopped")

# Global Agentic service instance
autonomous_service = AutonomousAgenticService()
