from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger as logger
from app.services.db_services import get_unreplied_mentions
from app.utils.agentic_ai import agentic_llm_call


async def process_unreplied_mentions(db: AsyncSession):
    """Process all unreplied mentions across all platforms."""
    try:
        # Get all unreplied mentions
        mentions = await get_unreplied_mentions(db)
        
        if not mentions:
            logger.info("No unreplied mentions found")
            return {"status": "no_unreplied_mentions", "processed": 0}

        processed_count = 0
        failed_count = 0
        
        for mention in mentions:
            try:
                # Process each mention with Agentic AI
                
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