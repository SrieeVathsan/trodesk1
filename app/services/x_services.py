import os
import requests
from requests_oauthlib import OAuth1

from app.models.models import MentionPost, Platform
from app.services.db_services import get_unreplied_mentions, store_mentions, update_mentions_after_reply
from app.utils.file_handling import read_last_id, save_last_id
from app.core.config import X_USER_ID, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_CONSUMER_KEY, X_CONSUMER_SECRET

from sqlalchemy.ext.asyncio import AsyncSession


MENTIONS_URL = f"https://api.twitter.com/2/users/{X_USER_ID}/mentions"
REPLY_URL = "https://api.twitter.com/2/tweets"

# OAuth1 Setup (manual headers with httpx)
OAUTH = OAuth1(X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, signature_type='auth_header')

async def fetch_mentions(db: AsyncSession):
    """Fetch mentions from X (Twitter) API."""
    since_id = await read_last_id()

    params = {
        "max_results": 100,
        "expansions": "author_id,attachments.media_keys",
        "tweet.fields": "id,text,created_at,public_metrics,attachments",
        "user.fields": "id,username,name,profile_image_url",
        "media.fields": "media_key,type,url,preview_image_url,duration_ms"
    }

    if since_id:
        params["since_id"] = since_id

    response = requests.get(MENTIONS_URL, auth=OAUTH, params=params)

    if response.status_code != 200:
        return {"error": response.status_code, "message": response.text}

    tweets = response.json()
    # print(tweets)
    platform = await db.get(Platform, "x")
    if not platform:
        platform = Platform(id="x", name="X")  # or "Twitter"
        db.add(platform)
        await db.commit()

    # Store
    data = tweets.get("data", [])
    if data:
        await store_mentions(tweets, db, platform_id="x")
    return tweets

def reply_to_tweet(tweet_id: str, text: str):
    payload = {
        "text": text,
        "reply": {
            "in_reply_to_tweet_id": tweet_id
        }
    }

    response = requests.post(REPLY_URL, auth=OAUTH, json=payload)

    if response.status_code == 201:
        return {
            "status": "success",
            "reply_id": response.json()["data"]["id"],
            "tweet_id": tweet_id
        }
    return {
        "status": "error",
        "tweet_id": tweet_id,
        "error_code": response.status_code,
        "error_message": response.text
    }

async def process_unreplied_mentions(db: AsyncSession):
    mentions = await get_unreplied_mentions(db)

    if not mentions:
        return {"status": "no_unreplied_tweets"}

    updates = []
    failed = []

    for mention in mentions:
        # 👇 Customize reply text here
        reply_text = generate_custom_reply(mention)

        # Call X API
        result = reply_to_tweet(mention.id, f"@{mention.user.username} {reply_text}")

        if result["status"] == "success":
            updates.append({
                "id": mention.id,
                "reply_id": result["reply_id"]
            })
        else:
            failed.append(result)

    # Bulk update DB
    await update_mentions_after_reply(db, updates)

    return {
        "status": "done",
        "replied": updates,
        "failed": failed
    }

def generate_custom_reply(mention: MentionPost) -> str:
    """Generate a context-aware reply based on the tweet."""
    if "thank" in mention.text.lower():
        return "You're most welcome! 🙌"
    elif "great" in mention.text.lower():
        return "Glad you liked it! 😊"
    return "Thank you for mentioning me!"