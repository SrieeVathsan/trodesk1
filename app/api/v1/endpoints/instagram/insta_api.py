from fastapi import APIRouter, Depends,HTTPException
from app.models.schemas.insta_schema import ReplyRequest 
from app.services.insta_service import (
    fetch_ig_mentions,
    fetch_ig_posts,
    instagram_conversations,
    instagram_private_reply,
    reply_to_mention,
    get_instagram_business_account,
)
from app.core.logger import app_logger
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
router=APIRouter(tags=["Instagram"])

@router.get("/instagram/posts")
async def get_insta_posts(access_token: str | None = None,ig_user_id:str=None):
    try:
        return await fetch_ig_posts(access_token=access_token,ig_user_id=ig_user_id)  
    except Exception as e:
        app_logger.info(f"Error fetching posts from instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/instagram/mentions")
async def get_mentions(access_token: str | None = None, db:AsyncSession=Depends(get_db),ig_user_id:str=None):
    try:
        return await fetch_ig_mentions(db=db, access_token=access_token,ig_user_id=ig_user_id)  
    except Exception as e:
        app_logger.info(f"Error fetching mentioned posts from instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/instagram/conversations")
async def get_conversations(access_token: str | None = None,ig_user_id:str=None):
    try:
        return await instagram_conversations(access_token=access_token,ig_user_id=ig_user_id)  
    except Exception as e:
        app_logger.info(f"Error fetching conversations from instagram")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/instagram/private-reply")
async def send_private_reply(comment_id: str, message: str, access_token: str | None = None,ig_user_id:str=None):  
    try:
        return await instagram_private_reply(comment_id, message, access_token=access_token,ig_user_id=ig_user_id)  
    except Exception as e:
        app_logger.info(f"Error sending private message in instagram {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/instagram/reply-to-mentions")
async def send_reply_for_comments(request:ReplyRequest, access_token: str | None = None, db: AsyncSession = Depends(get_db)):
    
    try:
        return await reply_to_mention(db, request.media_id, request.comment_text, access_token=access_token)  
    except Exception as e:
        app_logger.info(f"Error replying the comments {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/instagram/business-account")
async def get_ig_business_account(page_id: str, page_access_token: str):
    try:
        return await get_instagram_business_account(page_id, page_access_token)
    except HTTPException:
        raise
    except Exception as e:
        app_logger.info(f"Error fetching Instagram business account for page_id={page_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instagram/post/comments/")
async def get_instagram_post_comments(
    media_id: str,
    access_token: str,
):
    """
    Fetch comments for an Instagram media post with nested replies.
    """
    try:
        from httpx import AsyncClient
        from app.core.config import GRAPH
        
        url = f"{GRAPH}/{media_id}/comments"
        params = {
            "access_token": access_token,
            "fields": "id,text,username,timestamp,replies{id,text,username,timestamp}"
        }
        
        async with AsyncClient() as client:
            resp = await client.get(url, params=params)
            data = resp.json()
            
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            return {"success": True, "data": data.get("data", [])}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Error fetching Instagram post comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instagram/post/comment/reply")
async def reply_to_instagram_comment(
    comment_id: str,
    message: str,
    access_token: str,
):
    """
    Reply to an Instagram comment.
    """
    try:
        from httpx import AsyncClient
        from app.core.config import GRAPH
        
        url = f"{GRAPH}/{comment_id}/replies"
        params = {
            "access_token": access_token,
            "message": message
        }
        
        async with AsyncClient() as client:
            resp = await client.post(url, params=params)
            data = resp.json()
            
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Error replying to Instagram comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
