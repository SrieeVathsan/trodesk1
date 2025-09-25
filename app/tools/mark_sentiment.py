from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger as logger
from app.models.models import MentionPost
import json


async def mark_sentiment(db: AsyncSession, sentiment_data):
    """
    Mark the sentiment of mention posts based on JSON input.
    
    :param db: AsyncSession for database operations
    :param sentiment_data: Either a JSON string or dict containing mention sentiment data
                          Format: {"mentions": [{"id": "123", "sentiment": "positive"}, ...]}
                          Or: {"id": "123", "sentiment": "positive"} for single mention
    """
    try:
        # Parse JSON if it's a string
        if isinstance(sentiment_data, str):
            # Remove outer quotes if they exist (handle both single and double quotes)
            cleaned_data = sentiment_data.strip()
            if (cleaned_data.startswith("'") and cleaned_data.endswith("'")) or \
               (cleaned_data.startswith('"') and cleaned_data.endswith('"')):
                cleaned_data = cleaned_data[1:-1]  # Remove outer quotes
            
            data = json.loads(cleaned_data)
        else:
            data = sentiment_data
        
        results = []
        
        # Handle single mention format
        if "id" in data and "sentiment" in data:
            mention_id = data["id"]
            sentiment = data["sentiment"]
            
            mention = await db.get(MentionPost, mention_id)
            if not mention:
                logger.warning(f"MentionPost with id {mention_id} not found")
                results.append({"id": mention_id, "status": "not_found"})
            else:
                mention.sentiment = sentiment
                await db.commit()
                logger.info(f"Sentiment for MentionPost {mention_id} updated to {sentiment}")
                results.append({"id": mention_id, "status": "success"})
        
        # Handle multiple mentions format
        elif "mentions" in data:
            for mention_data in data["mentions"]:
                mention_id = mention_data["id"]
                sentiment = mention_data["sentiment"]
                
                mention = await db.get(MentionPost, mention_id)
                if not mention:
                    logger.warning(f"MentionPost with id {mention_id} not found")
                    results.append({"id": mention_id, "status": "not_found"})
                else:
                    mention.sentiment = sentiment
                    await db.commit()
                    logger.info(f"Sentiment for MentionPost {mention_id} updated to {sentiment}")
                    results.append({"id": mention_id, "status": "success"})
        
        # Handle array format directly
        elif isinstance(data, list):
            for mention_data in data:
                mention_id = mention_data["id"]
                sentiment = mention_data["sentiment"]
                
                mention = await db.get(MentionPost, mention_id)
                if not mention:
                    logger.warning(f"MentionPost with id {mention_id} not found")
                    results.append({"id": mention_id, "status": "not_found"})
                else:
                    mention.sentiment = sentiment
                    await db.commit()
                    logger.info(f"Sentiment for MentionPost {mention_id} updated to {sentiment}")
                    results.append({"id": mention_id, "status": "success"})
        
        else:
            return {"status": "error", "message": "Invalid input format"}
        
        return {
            "status": "success", 
            "message": "Sentiment analysis results saved to database successfully.",
            "results": results
        }
    
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON in mark_sentiment: {e}")
        return {"status": "error", "message": "Invalid JSON format for mention data"}
    except Exception as e:
        logger.error(f"Error marking sentiment: {e}")
        return {"status": "error", "message": str(e)}