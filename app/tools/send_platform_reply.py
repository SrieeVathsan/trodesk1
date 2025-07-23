from typing import Dict
from app.core.logger import app_logger as logger
from app.models.models import MentionPost
from app.services.facebook_service import reply_to_post
from app.utils.agentic_ai import get_user_context


async def send_platform_response(db, post: MentionPost, response_data: Dict):
    """Send the response to the appropriate platform"""
    reply_text = response_data.get('reply_text', '')
    
    # Get user information for platform-specific formatting
    user_context = await get_user_context(db, post.user_id or "unknown")
    user_info = user_context.get('user_info', {})
    username = user_info.get('username', '')
    
    if post.platform_id == "facebook":
        
        # Facebook doesn't need @ in comments, just use the username naturally
        formatted_reply = reply_text
        await reply_to_post(db, post_id=post.id, message=formatted_reply)
        
    elif post.platform_id == "instagram":
        from app.services.insta_service import reply_to_mention
        # Instagram uses @ for mentions in comments
        await reply_to_mention(db, media_id=post.id, comment_text=reply_text)
        
    elif post.platform_id == "x":
        from app.services.x_services import reply_to_tweet
        # X/Twitter uses @ for mentions and needs it for replies
        await reply_to_tweet(db, tweet_id=post.id, text=reply_text)
    
    # Log the personalized response
    logger.info(f"💬 Sent personalized reply to @{username}: {reply_text[:100]}...")
    
    # Update database
    post.sentiment = response_data.get('sentiment')
    post.reply_message = reply_text
    post.is_reply = True
    await db.commit()