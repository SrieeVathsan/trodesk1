from typing import Dict, List
from app.core.logger import app_logger as logger
from app.models.models import MentionPost
from app.services.facebook_service import reply_to_post
from app.utils.agentic_ai import get_user_context
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


async def send_platform_response(db: AsyncSession, reply_data: Dict) -> Dict:
    """
    Send a reply to a specific mention on the appropriate platform.
    
    Args:
        db: Database session
        reply_data: Dict containing:
            - mention_id: ID of the mention to reply to
            - reply_text: Generated reply text
    
    Returns:
        Dict with operation results
    """
    try:
        mention_id = reply_data.get('mention_id')
        reply_text = reply_data.get('reply_text', '')
        
        if not mention_id or not reply_text:
            return {
                "status": "error",
                "message": "Missing mention_id or reply_text",
                "successful_replies": 0
            }
        
        # Get the mention post from database
        from sqlalchemy import select
        result = await db.execute(select(MentionPost).where(MentionPost.id == mention_id))
        mention_post = result.scalar_one_or_none()
        if not mention_post:
            return {
                "status": "error",
                "message": f"Mention post not found: {mention_id}",
                "successful_replies": 0
            }
        
        # Get user information for platform-specific formatting
        user_context = await get_user_context(db, mention_post.user_id or "unknown")
        user_info = user_context.get('user_info', {})
        username = user_info.get('username', '')
        
        platform_reply_success = False
        platform_error = None
        
        # Send reply based on platform
        try:
            if mention_post.platform_id == "facebook":
                # Facebook doesn't need @ in comments, just use the username naturally
                await reply_to_post(db, post_id=mention_post.id, message=reply_text)
                platform_reply_success = True
                
            elif mention_post.platform_id == "instagram":
                from app.services.insta_service import reply_to_mention
                # Instagram uses @ for mentions in comments
                await reply_to_mention(db, media_id=mention_post.id, comment_text=reply_text)
                platform_reply_success = True
                
            elif mention_post.platform_id == "x":
                from app.services.x_services import reply_to_tweet
                # X/Twitter uses @ for mentions and needs it for replies
                await reply_to_tweet(db, tweet_id=mention_post.id, text=reply_text)
                platform_reply_success = True
                
        except Exception as platform_error_detail:
            platform_error = platform_error_detail
            logger.warning(f"Platform reply failed for {mention_post.platform_id}: {platform_error_detail}")
        
        # Update database regardless of platform success (for tracking purposes)
        logger.info(f"Updating database for mention {mention_id}: setting reply_message and is_reply=True")
        mention_post.reply_message = reply_text
        mention_post.is_reply = True
        await db.commit()
        logger.info(f"Database updated successfully for mention {mention_id}")
        
        # Verify the update
        updated_result = await db.execute(select(MentionPost).where(MentionPost.id == mention_id))
        updated_post = updated_result.scalar_one_or_none()
        logger.info(f"Verification: mention {mention_id} is_reply={updated_post.is_reply}, reply_message='{updated_post.reply_message[:50] if updated_post.reply_message else None}...'")
        
        if platform_reply_success:
            # Log the response
            logger.info(f"💬 Sent reply to @{username} on {mention_post.platform_id}: {reply_text[:100]}...")
            
            return {
                "status": "success",
                "message": f"Successfully sent reply to mention {mention_id} on {mention_post.platform_id}",
                "successful_replies": 1,
                "platform": mention_post.platform_id,
                "username": username
            }
        else:
            # Platform failed but database updated
            logger.info(f"📝 Database updated for mention {mention_id} but platform reply failed")
            return {
                "status": "partial_success",
                "message": f"Database updated but platform reply failed for mention {mention_id}: {platform_error}",
                "successful_replies": 0,
                "platform": mention_post.platform_id,
                "username": username,
                "database_updated": True
            }
        
    except Exception as e:
        error_msg = f"Error sending reply to mention {reply_data.get('mention_id', 'unknown')}: {str(e)}"
        logger.error(error_msg)
        return {
            "status": "error",
            "message": error_msg,
            "successful_replies": 0
        }
