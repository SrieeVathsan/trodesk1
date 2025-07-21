from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.models.schemas.linked_schema import CommentRequest, PostRequest
from app.services.linkedIn_service import (
    create_post,
    fetch_org_mentions,
    get_comments,
    create_comment,
    list_conversations,
    get_conversation_messages,
    send_message,
    create_conversation_and_send
)
from app.core.config import AUTHUR_URN

router = APIRouter(tags=["LinkedIn"])



# Posts endpoints
@router.post("/posts")
async def create_linkedin_post(post: PostRequest):
    try:
        post_id = await create_post(post.text)
        return {"success": True, "post_id": post_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/posts/{post_urn}/comments")
async def get_post_comments(
    post_urn: str,
    start: int = 0,
    count: int = 20
):
    try:
        comments = await get_comments(post_urn, start, count)
        return {"success": True, "comments": comments}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/posts/{post_urn}/comments")
async def add_comment_to_post(
    post_urn: str,
    comment: CommentRequest
):
    try:
        result = await create_comment(
            post_urn=post_urn,
            text=comment.text,
            mention_attrs=comment.mention_attrs
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Conversations endpoints
@router.get("/linkedin/conversations")
async def get_conversations(
    start: int = 0,
    count: int = 20
):
    try:
        conversations = await list_conversations(start, count)
        return {"data": conversations}  # Changed to match frontend expectation
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.get("/org/mentions")
async def api_org_mentions(AUTHUR_URN:str, start: int = 0, count: int = 20):
    return await fetch_org_mentions(AUTHUR_URN, start, count)
