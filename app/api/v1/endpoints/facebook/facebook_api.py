from typing import List, Optional
from pydantic import BaseModel
from app.core.config import GRAPH,FB_PAGE_ID,PAGE_ACCESS_TOKEN
from fastapi import Depends, File, HTTPException,APIRouter, UploadFile
from httpx import AsyncClient
from app.services.facebook_service import get_fb_mentions,get_fb_posts,reply_in_private, create_fb_post
from app.core.logger import app_logger
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Form
from app.services.facebook_service import reply_to_post

router=APIRouter(tags=["Facebook"])



class FacebookAuthPayload(BaseModel):
    access_token: str
    user_id: str
    name: str
    email: Optional[str] = None
    picture: Optional[str] = None


@router.post("/facebook/auth")
async def facebook_auth(payload: FacebookAuthPayload, db: AsyncSession = Depends(get_db)):
    """
    Endpoint to receive Facebook login payload from the frontend.

    Expected JSON body:
    {
      "access_token": string,
      "user_id": string,
      "name": string,
      "email": string | null,
      "picture": string | null
    }
    """
    try:
        app_logger.info(f"Facebook auth payload received for user_id={payload.user_id}")
        # TODO: Optionally verify token with Facebook Graph API and/or persist user/session.
        return {"status": "ok", "user": payload.model_dump()}
    except Exception as e:
        app_logger.info(f"Error handling Facebook auth: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/posts")
async def create_facebook_post(
    message: str = Form(...),
    photo_urls: Optional[str] = Form(None),  # will be JSON string if provided
    access_token: Optional[str] = Form(None),
    image_files: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        image_bytes = []
        image_filenames = []
        if image_files:
            for upload in image_files:
                contents = await upload.read()
                image_bytes.append(contents)
                image_filenames.append(upload.filename or "unknown")

        # Parse photo_urls if provided as a JSON string
        photo_list = []
        if photo_urls:
            import json
            photo_list = json.loads(photo_urls)

        return await create_fb_post(
            db=db,
            message=message,
            photo_urls=photo_list,
            image_files=image_bytes,
            image_filenames=image_filenames,
            access_token=access_token,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/facebook/posts")
async def get_facebook_posts(access_token: Optional[str] = None, db:AsyncSession=Depends(get_db)):
    try:
        return await get_fb_posts(db=db, access_token=access_token)
    except Exception as e:
        app_logger.info(f"Error while fetching facebook posts {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/facebook/mentions")
async def get_facebook_mentions(access_token: Optional[str] = None, db:AsyncSession=Depends(get_db)):
    try:
        return await get_fb_mentions(db=db, access_token=access_token) 
    except Exception as e:
        app_logger.info(f"Error while fetching mentions from facebook {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/reply")
async def reply_to_facebook_post(post_id: str, message: str, access_token: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    try:
        return await reply_to_post(db, post_id, message, access_token=access_token)  
    except Exception as e:
        app_logger.info(f"Error sending reply to the user in facebook")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/facebook/sent_private")
async def reply_in_dm(post_id: str, message: str, access_token: Optional[str] = None):
    try:
        return await reply_in_private(post_id, message, access_token=access_token)  
    except Exception as e:
        app_logger.info(f"Error sending reply to the user in facebook")
        raise HTTPException(status_code=500, detail=str(e))

# @router.get("/facebook/conversations")
# async def get_facebook_conversations():
#     try:
#         # For now, return mock data - you can implement actual Facebook conversations API later
#         return {
#             "data": [
#                 {
#                     "id": "fb_conv_1",
#                     "username": "Facebook User 1",
#                     "last_message": "Hello, I have a question about your product",
#                     "timestamp": "2025-01-18T10:00:00Z",
#                     "unread": True,
#                     "avatar": "https://via.placeholder.com/40"
#                 },
#                 {
#                     "id": "fb_conv_2", 
#                     "username": "Facebook User 2",
#                     "last_message": "Thanks for the help!",
#                     "timestamp": "2025-01-18T09:30:00Z",
#                     "unread": False,
#                     "avatar": "https://via.placeholder.com/40"
#                 }
#             ]
#         }
#     except Exception as e:
#         app_logger.info(f"Error fetching conversations from facebook: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

@router.get("/facebook/conversations")
async def get_facebook_conversations(
    page_id: str=Query(...),
    access_token: str=Query(...)
):
    """
    Return list of conversations for a Page.
    """
    # Build URL & params
    url = f"{GRAPH}/{FB_PAGE_ID}/conversations"
    params = {
        "access_token": access_token,
        # Optional: ask for participants and latest messages
        "fields": "id,updated_time,participants,messages.limit(1){message,from,to,created_time}"
    }

    async with AsyncClient() as client:
        resp = await client.get(url, params=params)
        data = resp.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"]["message"])

    # Return something more friendly
    return {
        "conversations": data.get("data", []),
        "paging": data.get("paging")
    }

@router.post("/facebook/message/send")
async def send_facebook_dm(
    page_id:str = Form(...),
    access_token: str = Form(...),
    recipient_psid: str = Form(...),
    message_text: str = Form(...),
):
    url = f"{GRAPH}/{FB_PAGE_ID}/messages?access_token={access_token}"
    payload = {
        "recipient": {"id": recipient_psid},
        "message": {"text": message_text},
        "messaging_type": "RESPONSE"
    }
    headers = {"Content-Type": "application/json"}
    async with AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()
        if resp.status_code != 200 or "error" in data:
            # Prefer giving the full error object if available
            error_msg = data.get("error", {}).get("message", str(data))
            raise HTTPException(status_code=resp.status_code, detail=error_msg)
    return {"success": True, "data": data}