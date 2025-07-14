from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import HTTPException,APIRouter
from httpx import AsyncClient
from app.services.facebook_service import get_fb_mentions,get_fb_posts,reply_to_post,reply_in_private
from app.core.logger import app_logger

router=APIRouter(tags=["Facebook"])

@router.get("/facebook/posts")
async def get_facebook_posts():
    try:
        return await get_fb_posts()
    except Exception as e:
        app_logger.info(f"Error while fetching facebook posts {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/facebook/mentions")
async def get_facebook_mentions():
    try:
        return await get_fb_mentions() 
    except Exception as e:
        app_logger.info(f"Error while fetching mentions from facebook {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/reply")
async def reply_to_facebook_post(post_id: str, message: str):
    try:
        return await reply_to_post(post_id, message)  
    except Exception as e:
        app_logger.info(f"Error sending reply to the user in facebook")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/sent_private")
async def reply_in_dm(post_id: str, message: str):
    try:
        return await reply_in_private(post_id, message)  
    except Exception as e:
        app_logger.info(f"Error sending reply to the user in facebook")
        raise HTTPException(status_code=500, detail=str(e))