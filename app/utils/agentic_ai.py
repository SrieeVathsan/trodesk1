import json
import asyncio
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from groq import AsyncGroq
from sqlalchemy import select, desc
from app.models.models import MentionPost, User
from app.core.config import GROQ_API_KEY
from app.core.logger import app_logger as logger

client = AsyncGroq(api_key=GROQ_API_KEY)
   
async def get_user_context(db, user_id: str) -> Dict:
    """Get user's previous posts and replies from MentionPost table"""
    # Get user information first
    user_query = select(User).where(User.id == user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    # Get last 5 posts from this user that have replies
    query = select(MentionPost).where(
        MentionPost.user_id == user_id,
        MentionPost.reply_message.isnot(None)
    ).order_by(desc(MentionPost.created_at)).limit(5)
    
    result = await db.execute(query)
    previous_posts = result.scalars().all()
    
    return {
        "user_info": {
            "username": user.username if user else "unknown_user",
            "display_name": user.display_name if user else "Unknown User",
            "user_id": user_id
        },
        "previous_interactions": [
            {
                "user_post": post.text,
                "ai_reply": post.reply_message,
                "sentiment": post.sentiment,
                "timestamp": post.created_at.isoformat() if post.created_at else None
            } for post in previous_posts
        ],
        "total_previous_posts": len(previous_posts)
    }
    

async def process_mention(db, post: MentionPost) -> Dict:
    """Process a mention: analyze post → generate reply → send reply"""
    try:
        logger.info(f"🤖 Agentic AI processing mention {post.id} from {post.platform_id}")
        
        # Step 1: Get user context from existing MentionPost history (optional)
        user_context = await get_user_context(db, post.user_id or "unknown")
        logger.info(f"📚 Retrieved user context: {user_context.get('total_previous_posts', 0)} previous posts")
                    
        # Step 4: Execute plan - generate and send reply
        logger.info(f"⚡ Executing response plan for {post.id}")
        response_result = await execute_response_plan(db, post)

        logger.info(f"✅ Agentic processing complete for {post.id}")
        
        return {
            "success": True,
            "response": response_result
        }
        
    except Exception as e:
        logger.error(f"❌ Agentic AI error for mention {post.id}: {str(e)}")
        raise

async def execute_response_plan(db, post: MentionPost) -> Dict:
    """Execute the response plan using selected tools"""
    
    # Get user information for personalized response
    user_context = await get_user_context(db, post.user_id or "unknown")
    user_info = user_context.get('user_info', {})
    username = user_info.get('username', 'friend')
    display_name = user_info.get('display_name', 'there')
    
    # Enhanced prompt with plan and tool information
    enhanced_prompt = f"""
    You are an advanced agentic AI executing a carefully crafted response plan.
    
    EXECUTION CONTEXT:
    - Platform: {post.platform_id}
    - Original Post: {post.text}
    - User's Username: {username}
    - User's Display Name: {display_name}
            
    GREETING RULES (VERY IMPORTANT):
    1. For POSITIVE/FRIENDLY captions: Use casual greetings like "Hey @{username}" or "Hi @{username}"
    2. For NEGATIVE captions: Use "Hii @{username}" and MUST include "our team will reach you shortly"
    3. For NEUTRAL captions: Use "Hii @{username}" in a friendly manner
    4. ALL responses must be in a friendly manner
    
    EXECUTION INSTRUCTIONS:
    1. Follow the strategy outlined in the plan
    5. IMPORTANT: Start your reply with @{username} to make it personal and engaging
    6. If username is not available, use a friendly greeting instead
    
    Generate a response in JSON format:
    {{
        "sentiment": "positive|negative|neutral",
        "reply_text": "Your response following the greeting rules",
        "post_id": "{post.id}",
        "confidence_level": 0.9,
        "reasoning": "Why this response was chosen",
        "personalization_applied": "How you personalized it with username @{username}",
        "strategy_implemented": "How you followed the plan"
    }}
    
    EXAMPLES:
    - For positive post: "Hey @{username} Thank you so much! We're thrilled you love it! 🎉"
    - For negative post: "Hii @{username} We're sorry to hear about this. Let us help you resolve it quickly.Our team will reach you shortly to help resolve it."
    - For question: "Hii @{username} Great question! Here's what you need to know..." 
    - For neutral post: "Hii @{username}, thanks for sharing! We'd love to hear more about your experience."
    """
    
    response = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": enhanced_prompt}],
        temperature=0.4,
        response_format={"type": "json_object"}
    )
    
    response_data = json.loads(response.choices[0].message.content)
    
    # Execute the actual platform response
    # await self._send_platform_response(db, post, response_data)
    
    return response_data



# Main function to replace the old llm_call
async def agentic_llm_call(db, post: MentionPost):
    """Agentic AI version of llm_call"""
    return await process_mention(db, post)
