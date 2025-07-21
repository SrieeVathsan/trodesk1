from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import Depends, HTTPException,APIRouter
from httpx import AsyncClient
from app.services.facebook_service import get_fb_mentions,get_fb_posts,reply_in_private
from app.core.logger import app_logger
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.facebook_service import reply_to_post

router=APIRouter(tags=["Facebook"])

@router.get("/facebook/posts")
async def get_facebook_posts(db:AsyncSession=Depends(get_db)):
    try:
        return await get_fb_posts(db=db)
    except Exception as e:
        app_logger.info(f"Error while fetching facebook posts {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/facebook/mentions")
async def get_facebook_mentions(db:AsyncSession=Depends(get_db)):
    try:
        return await get_fb_mentions(db=db) 
    except Exception as e:
        app_logger.info(f"Error while fetching mentions from facebook {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/reply")
async def reply_to_facebook_post(post_id: str, message: str, db: AsyncSession = Depends(get_db)):
    try:
        return await reply_to_post(db, post_id, message)  
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

@router.get("/facebook/conversations")
async def get_facebook_conversations():
    try:
        # For now, return mock data - you can implement actual Facebook conversations API later
        return {
            "data": [
                {
                    "id": "fb_conv_1",
                    "username": "Facebook User 1",
                    "last_message": "Hello, I have a question about your product",
                    "timestamp": "2025-01-18T10:00:00Z",
                    "unread": True,
                    "avatar": "https://via.placeholder.com/40"
                },
                {
                    "id": "fb_conv_2", 
                    "username": "Facebook User 2",
                    "last_message": "Thanks for the help!",
                    "timestamp": "2025-01-18T09:30:00Z",
                    "unread": False,
                    "avatar": "https://via.placeholder.com/40"
                }
            ]
        }
    except Exception as e:
        app_logger.info(f"Error fetching conversations from facebook: {e}")
        raise HTTPException(status_code=500, detail=str(e))