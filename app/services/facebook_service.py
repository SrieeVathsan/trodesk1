from datetime import datetime
from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Platform, User, MentionPost
from app.services.db_services import store_mentions, get_unreplied_mentions, update_mentions_after_reply

async def get_fb_posts(db: AsyncSession):
    """Get posts from a Facebook Page and store in DB."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/posts"
        params = {
            "fields": "id,message,created_time,permalink_url,from,comments.summary(true),reactions.summary(true)",
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.get(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            # Ensure platform exists
            platform = await db.get(Platform, "facebook")
            if not platform:
                platform = Platform(id="facebook", name="Facebook")
                db.add(platform)
                await db.commit()

            # Store mentions
            if data.get("data"):
                await store_facebook_mentions(data, db, platform_id="facebook")
            
            return {
                "success": True,
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

async def get_fb_mentions(db: AsyncSession):
    """Get posts where the Page is tagged and store in DB."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/tagged"
        params = {
            "fields": "id,message,from,created_time,permalink_url,username",
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.get(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            # Ensure platform exists
            platform = await db.get(Platform, "facebook")
            if not platform:
                platform = Platform(id="facebook", name="Facebook")
                db.add(platform)
                await db.commit()

            # Store mentions
            if data.get("data"):
                await store_facebook_mentions(data, db, platform_id="facebook")
            
            return {
                "success": True,
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

async def store_facebook_mentions(response: dict, db: AsyncSession, platform_id: str):
    """Save Facebook mentions/posts to DB."""
    posts = response.get("data", [])
    
    for post in posts:
        post_id = post["id"]
        
        # Skip duplicates
        existing = await db.get(MentionPost, post_id)
        if existing:
            continue
        
        # Get author info
        author = post.get("from", {})
        author_id = author.get("id")
        author_name = author.get("name")
        
        # Ensure User exists
        if author_id:
            user = await db.get(User, author_id)
            if not user:
                user = User(
                    id=author_id,
                    username=author_id,  # Facebook doesn't provide username
                    display_name=author_name,
                    platform_id=platform_id
                )
                db.add(user)
        
        # Parse created_at
        created_at = post.get("created_time")
        dt = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S%z") if created_at else None
        
        # Create MentionPost record
        mention = MentionPost(
            id=post_id,
            platform_id=platform_id,
            user_id=author_id,
            text=post.get("message"),
            created_at=dt
        )
        db.add(mention)
    
    await db.commit()

async def process_unreplied_fb_mentions(db: AsyncSession):
    """Process and reply to unreplied Facebook mentions."""
    mentions = await get_unreplied_mentions(db)
    
    if not mentions:
        return {"status": "no_unreplied_mentions"}
    
    updates = []
    failed = []
    
    for mention in mentions:
        if mention.platform_id != "facebook":
            continue
            
        # Customize reply text here
        reply_text = generate_custom_reply(mention)
        
        # Call Facebook API
        try:
            result = await reply_to_post(db, mention.id, reply_text)
            
            if result["success"]:
                updates.append({
                    "id": mention.id,
                    "reply_id": result["data"]["id"]  # Assuming API returns the reply ID
                })
            else:
                failed.append({
                    "id": mention.id,
                    "error": result.get("error", "Unknown error")
                })
        except Exception as e:
            failed.append({
                "id": mention.id,
                "error": str(e)
            })
    
    # Bulk update DB
    # await update_mentions_after_reply(db, updates)
    
    return {
        "status": "done",
        "replied": updates,
        "failed": failed
    }

def generate_custom_reply(mention: MentionPost) -> str:
    """Generate a context-aware reply based on the post."""
    if "thank" in mention.text.lower():
        return "You're most welcome! 🙌"
    elif "great" in mention.text.lower():
        return "Glad you liked it! 😊"
    return "Thank you for your post!"

async def reply_to_post(db: AsyncSession, post_id: str, message: str):
    """Reply to a Facebook post or comment."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{post_id}"
        params = {
            "message": message,
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.post(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            #db update
            await update_mentions_after_reply(db, [{"id": post_id, "reply_id": data.get("id"), "message": message}])

            return {
                "success": True,
                "data": data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        

async def reply_in_private(post_id: str, message: str):
    """Reply to a Facebook post or comment."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{post_id}/private_replies"
        params = {
            "message": message,
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.post(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            return {
                "success": True,
                "data": data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        


