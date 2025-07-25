from datetime import datetime
from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Platform, User, MentionPost
from app.services.db_services import get_unreplied_mentions

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
            from app.services.db_services import update_mentions_after_reply
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
        


