from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import HTTPException
from httpx import AsyncClient







async def get_fb_posts():
    """Get posts from a Facebook Page."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/posts"
        params = {
            "fields": "id,message,created_time,permalink_url,comments.summary(true),reactions.summary(true)",
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.get(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            return {
                "success": True,
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

async def get_fb_mentions():
    """Get posts where the Page is tagged."""
    async with AsyncClient() as client:
        url = f"{GRAPH}/{FB_PAGE_ID}/tagged"
        params = {
            "fields": "id,message,from,created_time",
            "access_token": PAGE_ACCESS_TOKEN
        }
        try:
            response = await client.get(url, params=params)
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            return {
                "success": True,
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

async def reply_to_post(post_id: str, message: str):
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
        


