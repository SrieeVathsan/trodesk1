import json
from fastapi import Request, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient
import logging
from datetime import datetime
import os
from dotenv import load_dotenv
from app.core.config import IG_USER_ID,ACCESS_TOKEN,GRAPH,VERIFY_TOKEN
import requests
from app.models.models import MentionPost, Platform, User
from app.services.db_services import get_unreplied_mentions




async def send_instagram_message(to_user_id: str, message_body: str):
    """Send an Instagram DM to a user."""
    async with AsyncClient() as http_client:
        url = f"{GRAPH}/{IG_USER_ID}/messages"
        data = {
            "recipient": {"id": to_user_id},
            "message": {"text": message_body},
            "access_token": ACCESS_TOKEN
        }
        try:
            resp = await http_client.post(url, json=data)
            data = resp.json()
            if "error" in data:
                logging.error(f"Failed to send Instagram DM: {data['error']}")
                raise HTTPException(status_code=400, detail=f"API Error: {data['error']}")
            logging.info(f"DM sent to {to_user_id}: {message_body}")
            return True
        except Exception as e:
            logging.error(f"Error sending Instagram DM: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to send DM: {str(e)}")

async def handle_instagram_message(to_user_id: str, message_body: str, profile_name: str, db: AsyncSession):
    """Process incoming Instagram messages and respond."""
    # Simple keyword-based responses (like WhatsApp)
    if any(keyword in message_body.lower() for keyword in ['hi', 'hello', 'hey']):
        response = f"Hi {profile_name}, how can we assist you today?"
    elif any(keyword in message_body.lower() for keyword in ['payments', 'credit', 'payment status', 'transactions']):
        response = "Please specify a year or month for the payment summary.\nExample: Payments for January 2024"
    else:
        response = "Thanks for your message! We'll get back to you soon."

    # Send response
    await send_instagram_message(to_user_id, response)

async def verify_instagram_webhook(request: Request):
    """Verify Instagram webhook subscription."""
    try:
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token')
        challenge = request.query_params.get('hub.challenge')
        logging.info(f"Webhook verification: mode={mode}, token={token}")

        if mode == 'subscribe' and token == VERIFY_TOKEN:
            logging.info("Webhook verification successful")
            return int(challenge)
        else:
            raise HTTPException(status_code=403, detail="Verification failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification error: {str(e)}")

async def handle_instagram_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming Instagram webhook events."""
    try:
        data = await request.json()
        logging.info(f"Received Instagram webhook: {json.dumps(data, indent=2)}")

        if data.get("object") == "instagram":
            for entry in data.get("entry", []):
                for event in entry.get("messaging", []):
                    sender_id = event.get("sender", {}).get("id")
                    message = event.get("message", {})

                    if "text" in message:
                        message_body = message["text"]
                        profile_name = f"User_{sender_id}"

                        background_tasks.add_task(
                            handle_instagram_message,
                            sender_id,
                            message_body,
                            profile_name,
                        )
                        logging.info(f"Queued message from {sender_id}: {message_body}")

        return JSONResponse(content={"status": "success"})

    except Exception as e:
        logging.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")



async def fetch_ig_posts():
    """
    Fetch posts from the authenticated Instagram account.
    """
    async with AsyncClient() as http_client:
        url = f"{GRAPH}/{IG_USER_ID}/media"
        params = {
            "fields": "id,caption,media_type,media_url,timestamp,permalink",
            "access_token": ACCESS_TOKEN
        }
        try:
            resp = await http_client.get(url, params=params)
            data = resp.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            return {
                "success": True,
                "message": f"Fetched {len(data.get('data', []))} posts from Instagram",
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch posts: {str(e)}")

async def fetch_ig_mentions(db: AsyncSession):
    """
    Fetch posts and stories where the Instagram account is tagged/mentioned.
    Stores them in the database similar to X (Twitter) mentions.
    """
    async with AsyncClient() as http_client:
        # Try mentions endpoint first
        url = f"{GRAPH}/{IG_USER_ID}/mentions"
        params = {
            "fields": "id,caption,media_type,media_url,timestamp,permalink,username,owner",
            "access_token": ACCESS_TOKEN
        }
        try:
            resp = await http_client.get(url, params=params)
            data = resp.json()
            
            if "error" in data:
                # Fallback to tags endpoint if mentions not supported
                if "nonexisting field (mentions)" in data["error"]["message"]:
                    return await fetch_ig_tags(db)
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            # Ensure platform exists
            platform = await db.get(Platform, "instagram")
            if not platform:
                platform = Platform(id="instagram", name="Instagram")
                db.add(platform)
                await db.commit()
            
            # Store mentions
            if data.get("data"):
                await store_instagram_mentions(data, db, platform_id="instagram")
            
            return {
                "success": True,
                "message": f"Fetched {len(data.get('data', []))} mentions from Instagram",
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch mentions: {str(e)}")

async def fetch_ig_tags(db: AsyncSession):
    """Fallback for when mentions endpoint is not available."""
    async with AsyncClient() as http_client:
        url = f"{GRAPH}/{IG_USER_ID}/tags"
        params = {
            "fields": "id,caption,media_type,media_url,timestamp,permalink,username,owner",
            "access_token": ACCESS_TOKEN
        }
        try:
            resp = await http_client.get(url, params=params)
            data = resp.json()
            
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            # Ensure platform exists
            platform = await db.get(Platform, "instagram")
            if not platform:
                platform = Platform(id="instagram", name="Instagram")
                db.add(platform)
                await db.commit()
            
            # Store mentions
            if data.get("data"):
                await store_instagram_mentions(data, db, platform_id="instagram")
            
            return {
                "success": True,
                "message": f"Fetched {len(data.get('data', []))} tags from Instagram (mentions not supported)",
                "data": data.get("data", [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch tags: {str(e)}")

async def store_instagram_mentions(response: dict, db: AsyncSession, platform_id: str):
    """Save Instagram mentions/tags to DB."""
    posts = response.get("data", [])
    
    for post in posts:
        post_id = post["id"]
        
        # Skip duplicates
        existing = await db.get(MentionPost, post_id)
        if existing:
            continue
        
        # Get author info
        owner = post.get("owner", {})
        author_id = post["username"]
        username = post["username"]
        print("Username--------------------------->",owner)
        
        # Ensure User exists
        if author_id:
            user = await db.get(User, author_id)
            if not user:
                user = User(
                    id=author_id,
                    username=username,
                    display_name=username,  # Instagram doesn't provide display name separately
                    platform_id=platform_id
                )
                db.add(user)
        
        # Parse created_at
        timestamp = post.get("timestamp")
        dt = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S%z") if timestamp else None
        
        # Create MentionPost record
        mention = MentionPost(
            id=post_id,
            platform_id=platform_id,
            user_id=author_id,
            text=post.get("caption"),
            created_at=dt,
            media_url=post.get("media_url")
        )
        db.add(mention)
    
    await db.commit()


async def instagram_conversations():
    url = f"{GRAPH}/{IG_USER_ID}/conversations"
    params = {
        "platform": "instagram",
        "fields": "participants,messages{from,id,message,created_time}",
        "access_token": ACCESS_TOKEN
    }
    res = requests.get(url, params=params).json()
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"]["message"])
    return {"success": True, "conversations": res.get("data", [])}


async def instagram_private_reply(comment_id: str, message: str):
    url = f"{GRAPH}/{IG_USER_ID}/messages"
    payload = {
        "recipient": { "comment_id": comment_id },
        "message": { "text": message }
    }
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    res = requests.post(url, json=payload, headers=headers).json()
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"]["message"])
    return {"success": True, "message_id": res.get("message_id")}



async def reply_to_mention(db: AsyncSession, media_id: str, comment_text: str):
    """
    Reply to a post where your Instagram account is tagged/mentioned.
    Requires:
        - `media_id`: The ID of the post where you're tagged.
        - `comment_text`: The comment to post.
    """
    async with AsyncClient() as http_client:
        url = f"{GRAPH}/{media_id}/comments"
        params = {
            "message": comment_text,
            "access_token": ACCESS_TOKEN
        }
        try:
            resp = await http_client.post(url, params=params)
            data = resp.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"]["message"])
            
            # Update the mention in the database
            from app.services.db_services import update_mentions_after_reply
            await update_mentions_after_reply(db, [{
                "id": media_id,
                "reply_id": data.get("id"),
                "message": comment_text
            }])

            return {
                "success": True,
                "message": f"Replied to mention (ID: {media_id})",
                "data": data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to reply: {str(e)}")

