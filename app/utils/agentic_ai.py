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

class AgenticMemory:
    """Simple memory system using existing MentionPost table"""
    
    async def get_user_context(self, db, user_id: str) -> Dict:
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

class AgenticPlanner:
    """Multi-step planning system"""
    
    @staticmethod
    async def create_response_plan(post: MentionPost, context: Dict, memory: AgenticMemory) -> Dict:
        """Create a multi-step plan for responding"""
        
        # Extract user info from context
        user_info = context.get('user_info', {})
        username = user_info.get('username', 'user')
        display_name = user_info.get('display_name', 'there')
        
        planning_prompt = f"""
        You are an advanced AI planner. Create a detailed response strategy for this social media mention.
        
        Post Details:
        - Platform: {post.platform_id}
        - Content: {post.text}
        - User ID: {post.user_id}
        - Username: @{username}
        - Display Name: {display_name}
        
        User Context: {json.dumps(context, indent=2)}
        
        Create a JSON response plan with:
        1. "analysis" - Deep analysis of the post
        2. "strategy" - Response strategy (include using @{username} for engagement)
        3. "tone" - Appropriate tone to use
        4. "steps" - Array of specific steps to take
        5. "tools_needed" - What tools/platforms to use
        6. "followup_needed" - If follow-up is required
        7. "personalization" - How to personalize the response using @{username}
        
        IMPORTANT: Always plan to start responses with @{username} to make it personal and engaging.
        
        Respond in JSON format only.
        """
        
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": planning_prompt}],
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

class AgenticToolSelector:
    """Dynamic tool selection system"""
    
    available_tools = {
        "sentiment_analyzer": "Analyze sentiment deeply",
        "reply_generator": "Generate contextual replies", 
        "engagement_predictor": "Predict engagement potential",
        "escalation_detector": "Detect if escalation is needed",
        "personalization_engine": "Personalize responses",
        "quality_assessor": "Assess response quality"
    }
    
    @staticmethod
    async def select_tools(plan: Dict, post: MentionPost) -> List[str]:
        """Dynamically select which tools to use"""
        
        tool_selection_prompt = f"""
        Based on this response plan, select the most appropriate tools:
        
        Plan: {json.dumps(plan, indent=2)}
        Post: {post.text}
        Platform: {post.platform_id}
        
        Available Tools: {json.dumps(AgenticToolSelector.available_tools, indent=2)}
        
        Return JSON with:
        {{
            "selected_tools": ["tool1", "tool2", ...],
            "reasoning": "Why these tools were selected",
            "execution_order": ["step1", "step2", ...]
        }}
        """
        
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": tool_selection_prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

class AgenticReflector:
    """Self-reflection and improvement system"""
    
    @staticmethod
    async def reflect_on_response(original_post: str, generated_response: str, plan: Dict) -> Dict:
        """Reflect on the quality of the generated response"""
        
        reflection_prompt = f"""
        As an AI critic, evaluate this response:
        
        Original Post: {original_post}
        Generated Response: {generated_response}
        Original Plan: {json.dumps(plan, indent=2)}
        
        Provide a detailed evaluation in JSON:
        {{
            "quality_score": 0.8,
            "strengths": ["strength1", "strength2"],
            "weaknesses": ["weakness1", "weakness2"],
            "improvement_suggestions": ["suggestion1", "suggestion2"],
            "tone_appropriateness": 0.9,
            "personalization_level": 0.7,
            "engagement_potential": 0.8,
            "overall_assessment": "detailed assessment"
        }}
        """
        
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": reflection_prompt}],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

class AgenticAI:
    """Main Agentic AI system with database-backed memory"""
    
    def __init__(self):
        self.memory = AgenticMemory()
        self.planner = AgenticPlanner()
        self.tool_selector = AgenticToolSelector()
        self.reflector = AgenticReflector()
    
    async def process_mention(self, db, post: MentionPost) -> Dict:
        """Process a mention: analyze post → generate reply → send reply"""
        try:
            logger.info(f"🤖 Agentic AI processing mention {post.id} from {post.platform_id}")
            
            # Step 1: Get user context from existing MentionPost history (optional)
            user_context = await self.memory.get_user_context(db, post.user_id or "unknown")
            logger.info(f"📚 Retrieved user context: {user_context.get('total_previous_posts', 0)} previous posts")
            
            # Step 2: Create response plan
            logger.info(f"📋 Creating response plan for {post.id}")
            plan = await self.planner.create_response_plan(post, user_context, self.memory)
            logger.info(f"📋 Plan created: {plan.get('strategy', 'Unknown strategy')}")
            
            # Step 3: Select tools dynamically
            logger.info(f"🛠️ Selecting tools for {post.id}")
            tool_selection = await self.tool_selector.select_tools(plan, post)
            logger.info(f"🛠️ Selected tools: {tool_selection.get('selected_tools', [])}")
            
            # Step 4: Execute plan - generate and send reply
            logger.info(f"⚡ Executing response plan for {post.id}")
            response_result = await self._execute_response_plan(db, post, plan, tool_selection)
            
            logger.info(f"✅ Agentic processing complete for {post.id}")
            
            return {
                "success": True,
                "plan": plan,
                "tools_used": tool_selection.get('selected_tools', []),
                "response": response_result
            }
            
        except Exception as e:
            logger.error(f"❌ Agentic AI error for mention {post.id}: {str(e)}")
            raise
    
    async def _execute_response_plan(self, db, post: MentionPost, plan: Dict, tool_selection: Dict) -> Dict:
        """Execute the response plan using selected tools"""
        
        # Get user information for personalized response
        user_context = await self.memory.get_user_context(db, post.user_id or "unknown")
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
        - User Context: Previous interactions suggest {plan.get('personalization', 'standard approach')}
        
        RESPONSE PLAN:
        {json.dumps(plan, indent=2)}
        
        SELECTED TOOLS:
        {json.dumps(tool_selection, indent=2)}
        
        GREETING RULES (VERY IMPORTANT):
        1. For POSITIVE/FRIENDLY captions: Use casual greetings like "Hey @{username}" or "Hi @{username}"
        2. For NEGATIVE captions: Use "Hii @{username}" and MUST include "our team will reach you shortly"
        3. For NEUTRAL captions: Use "Hii @{username}" in a friendly manner
        4. ALL responses must be in a friendly manner
        
        EXECUTION INSTRUCTIONS:
        1. Follow the strategy outlined in the plan
        2. Use the specified tone: {plan.get('tone', 'professional')}
        3. Implement personalization: {plan.get('personalization', 'none')}
        4. Consider the steps: {plan.get('steps', [])}
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
        await self._send_platform_response(db, post, response_data)
        
        return response_data
    
    async def _send_platform_response(self, db, post: MentionPost, response_data: Dict):
        """Send the response to the appropriate platform"""
        reply_text = response_data.get('reply_text', '')
        
        # Get user information for platform-specific formatting
        user_context = await self.memory.get_user_context(db, post.user_id or "unknown")
        user_info = user_context.get('user_info', {})
        username = user_info.get('username', '')
        
        if post.platform_id == "facebook":
            from app.services.facebook_service import reply_to_post
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

# Global Agentic AI instance
agentic_ai = AgenticAI()

# Main function to replace the old llm_call
async def agentic_llm_call(db, post: MentionPost):
    """Agentic AI version of llm_call"""
    return await agentic_ai.process_mention(db, post)
