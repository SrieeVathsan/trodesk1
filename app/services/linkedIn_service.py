import httpx
from app.core.config import LINKEDIN_TOKEN, LINKEDIN_API_VERSION, AUTHUR_URN

HEADERS = {
    "Authorization": f"Bearer {LINKEDIN_TOKEN}",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "Content-Type": "application/json",
}

async def create_post(text: str):
    url = "https://api.linkedin.com/v2/ugcPosts"
    payload = {
        "author": AUTHUR_URN,  # e.g. "urn:li:organization:123456"
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }
    print("Payload:", payload)

    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=HEADERS, json=payload)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError:
            print("API error:", r.json())
            raise
        return r.headers.get("x-restli-id") or r.json().get("id")




async def get_comments(post_urn: str, start=0, count=20):
    # StackOverflow suggests using /rest/socialActions/… :contentReference[oaicite:3]{index=3}
    url = f"https://api.linkedin.com/rest/socialActions/{post_urn}/comments"
    params = {"start": start, "count": count}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=HEADERS, params=params)
        r.raise_for_status()
        return r.json().get("elements", [])

async def create_comment(post_urn: str, text: str, mention_attrs: list = None):
    url = f"https://api.linkedin.com/rest/socialActions/{post_urn}/comments"
    payload = {
        "actor": "urn:li:person:me",
        "object": post_urn,
        "message": {"text": text}
    }
    if mention_attrs:
        payload["message"]["attributes"] = mention_attrs
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=HEADERS, json=payload)
        r.raise_for_status()
        return r.json()

async def list_conversations(start=0, count=20):
    url = "https://api.linkedin.com/v2/conversations"
    params = {"start": start, "count": count}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=HEADERS, params=params)
        r.raise_for_status()
        return r.json().get("elements", [])

async def get_conversation_messages(convo_id: str, start=0, count=50):
    url = f"https://api.linkedin.com/v2/conversations/{convo_id}/messages"
    params = {"start": start, "count": count}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=HEADERS, params=params)
        r.raise_for_status()
        return r.json().get("elements", [])

async def send_message(convo_id: str, message_text: str):
    url = f"https://api.linkedin.com/v2/conversations/{convo_id}/messages"
    payload = {
        "conversation": convo_id,
        "eventContent": {
            "com.linkedin.voyager.messaging.create.MessageCreate": {
                "attributedBody": {"text": message_text},
                "attachments": []
            }
        }
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=HEADERS, json=payload)
        r.raise_for_status()
        return r.json()

async def create_conversation_and_send(recipient_urn: str, message_text: str):
    url = "https://api.linkedin.com/v2/messages"
    payload = {
        "recipients": [recipient_urn],
        "eventContent": {
            "com.linkedin.voyager.messaging.create.MessageCreate": {
                "attributedBody": {"text": message_text},
                "attachments": []
            }
        }
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=HEADERS, json=payload)
        r.raise_for_status()
        return r.json()

async def fetch_org_mentions(start=0, count=20):
    url = "https://api.linkedin.com/rest/posts"
    params = {
        "q": "author",
        "author": AUTHUR_URN,
        "start": start,
        "count": count
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=HEADERS, params=params)
        r.raise_for_status()
        return r.json().get("elements", [])
