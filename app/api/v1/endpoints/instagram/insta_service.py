from fastapi import APIRouter, Depends,HTTPException
from app.services.insta_service import fetch_ig_mentions,fetch_ig_posts,instagram_conversations,instagram_private_reply,reply_to_mention
from app.core.logger import app_logger
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
router=APIRouter(tags=["Instagram"])

@router.get("/instagram/posts")
async def get_insta_posts():
    try:
        return await fetch_ig_posts()  
    except Exception as e:
        app_logger.info(f"Error fetching posts from instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/instagram/mentions")
async def get_mentions(db:AsyncSession=Depends(get_db)):
    try:
        return await fetch_ig_mentions(db=db)  
    except Exception as e:
        app_logger.info(f"Error fetching mentioned posts from instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/instagram/conversations")
async def get_conversations():
    try:
        return await instagram_conversations()  
    except Exception as e:
        app_logger.info(f"Error fetching conversations from instagram")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/instagram/private-reply")
async def send_private_reply(comment_id: str, message: str):  
    try:
        return await instagram_private_reply(comment_id, message)  
    except Exception as e:
        app_logger.info(f"Error sending private message in instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/instagram/reply-to-mentions")
async def send_reply_for_comments(media_id: str, comment_text: str):  
    try:
        return await reply_to_mention(media_id, comment_text)  
    except Exception as e:
        app_logger.info(f"Error replying the comments {e}")
        raise HTTPException(status_code=500, detail=str(e))