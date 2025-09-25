from datetime import datetime
from app.core.config import GRAPH, FB_PAGE_ID, PAGE_ACCESS_TOKEN
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Platform, User, MentionPost
from app.services.db_services import get_unreplied_mentions
from typing import List, Optional

async def create_fb_text_post(db: AsyncSession, message: str, access_token: str | None = None):
    """
    Create a text-only Facebook Page post.
    """
    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/feed"
        params = {
            "message": message,
            "access_token": token
        }
        resp = await client.post(url, params=params)
        data = resp.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"]["message"])
        return {"success": True, "post_id": data.get("id"), "data": data}


async def create_fb_photo_post(
    db: AsyncSession,
    message: str,
    photo_urls: Optional[List[str]] = None,
    image_files: Optional[List[bytes]] = None,
    image_filenames: Optional[List[str]] = None,
    access_token: str | None = None,
):
    """
    Create a Facebook Page post with one or more photos.
    """
    if photo_urls is None:
        photo_urls = []
    if image_files is None:
        image_files = []
    if image_filenames is None:
        image_filenames = []
    if len(image_files) != len(image_filenames):
        raise ValueError("image_files and image_filenames length mismatch")

    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        # Case: one photo
        if len(photo_urls) + len(image_files) == 1:
            url = f"{GRAPH}/{FB_PAGE_ID}/photos"
            params = {
                "message": message,
                "access_token": token
            }
            files = None
            if photo_urls:
                params["url"] = photo_urls[0]
            else:
                files = {"source": (image_filenames[0], image_files[0], "image/jpeg")}

            resp = await client.post(url, params=params, files=files)
            data = resp.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            return {"success": True, "photo_post_id": data.get("id"), "data": data}

        # Case: multiple photos → upload each unpublished + attach
        photo_ids = []
        # upload URL photos
        for pu in photo_urls:
            up_url = f"{GRAPH}/{FB_PAGE_ID}/photos"
            params = {"access_token": token, "url": pu, "published": "false"}
            resp = await client.post(up_url, params=params)
            d = resp.json()
            if "error" in d:
                raise HTTPException(status_code=400, detail=f"Error uploading photo URL: {d['error']['message']}")
            photo_ids.append(d["id"])

        # upload file photos
        for img_bytes, fname in zip(image_files, image_filenames):
            up_url = f"{GRAPH}/{FB_PAGE_ID}/photos"
            params = {"access_token": token, "published": "false"}
            files = {"source": (fname, img_bytes, "image/jpeg")}
            resp = await client.post(up_url, params=params, files=files)
            d = resp.json()
            if "error" in d:
                raise HTTPException(status_code=400, detail=f"Error uploading photo file: {d['error']['message']}")
            photo_ids.append(d["id"])

        # attach to feed
        feed_url = f"{GRAPH}/{FB_PAGE_ID}/feed"
        params = {
            "message": message,
            "access_token": token,
            "attached_media": [{"media_fbid": pid} for pid in photo_ids]
        }
        resp = await client.post(feed_url, json=params)
        data = resp.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"]["message"])
        return {"success": True, "post_id": data.get("id"), "data": data}


async def get_fb_posts(db: AsyncSession, access_token: str | None = None):
    """Get posts from a Facebook Page and store in DB."""
    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/posts"
        params = {
            "fields": "id,message,created_time,permalink_url,from,comments.summary(true),reactions.summary(true)",
            "access_token": token
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

async def get_fb_mentions(db: AsyncSession, access_token: str | None = None):
    """Get posts where the Page is tagged and store in DB."""
    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/tagged"
        params = {
            "fields": "id,message,from,created_time,permalink_url,username",
            "access_token": token
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

async def reply_to_post(db: AsyncSession, post_id: str, message: str, access_token: str | None = None):
    """Reply to a Facebook post or comment."""
    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        url = f"{GRAPH}/{post_id}"
        params = {
            "message": message,
            "access_token": token
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
        

async def reply_in_private(post_id: str, message: str, access_token: str | None = None):
    """Reply to a Facebook post or comment."""
    token = access_token or PAGE_ACCESS_TOKEN
    async with AsyncClient() as client:
        url = f"{GRAPH}/{post_id}/private_replies"
        params = {
            "message": message,
            "access_token": token
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
        


