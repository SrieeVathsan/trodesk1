from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.models.models import Platform, User, MentionPost


async def get_unreplied_mentions(db: AsyncSession) -> List[MentionPost]:
    result = await db.execute(
        select(MentionPost)
        .options(selectinload(MentionPost.user))  # eagerly load user relationship
        .where(MentionPost.is_reply == False)
    )
    return result.scalars().all()

async def update_mentions_after_reply(db: AsyncSession, updates: List[dict]):
    """
    Apply updates to MentionPost after successful replies.
    Each update should have keys: id (mention id), reply_id (reply tweet id).
    """
    for item in updates:
        mention = await db.get(MentionPost, item["id"])
        if mention:
            mention.is_reply = True
            mention.replied_to_post_id = item["reply_id"]
    await db.commit()

async def store_mentions(mentions_response: dict, db: AsyncSession, platform_id: str):
    """
    Save mention tweets to DB with media support.
    - Expects full response including .data and .includes
    """

    tweets = mentions_response.get("data", [])
    includes = mentions_response.get("includes", {})
    users = {user["id"]: user for user in includes.get("users", [])}
    media_map = {media["media_key"]: media for media in includes.get("media", [])}

    for tweet in tweets:
        tweet_id = tweet["id"]

        # Skip duplicates
        existing = await db.get(MentionPost, tweet_id)
        if existing:
            continue

        # Get author info from includes
        author_id = tweet.get("author_id")
        user_info = users.get(author_id, {})
        username = user_info.get("username")
        display_name = user_info.get("name")

        # Ensure User exists
        if author_id:
            user = await db.get(User, author_id)
            if not user:
                user = User(
                    id=author_id,
                    username=username,
                    display_name=display_name,
                    platform_id=platform_id
                )
                db.add(user)

        # Parse media URL if available
        media_url = None
        media_keys = tweet.get("attachments", {}).get("media_keys", [])
        if media_keys:
            # Pick the first media with a valid URL
            for key in media_keys:
                media = media_map.get(key)
                if media:
                    media_url = media.get("url") or media.get("preview_image_url")
                    if media_url:
                        break

        # Parse created_at
        created_at = tweet.get("created_at")
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00")) if created_at else None

        # Create MentionPost record
        mention = MentionPost(
            id=tweet_id,
            platform_id=platform_id,
            user_id=author_id,
            text=tweet.get("text"),
            created_at=dt,
            media_url=media_url
        )
        db.add(mention)

    await db.commit()
