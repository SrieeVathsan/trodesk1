import asyncio
from app.api.v1.endpoints.facebook.facebook_api import get_facebook_mentions
from app.api.v1.endpoints.instagram.insta_api import get_mentions as get_instagram_mentions
from app.api.v1.endpoints.x.x_service import get_mentions as get_x_mentions
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter,Depends
from app.db.session import get_db


router=APIRouter(tags=["All API's"])

@router.get("/all/mentions")
async def get_all_mentions(db:AsyncSession=Depends(get_db)):
    """
    Get mentions from all connected social platforms (Facebook, Instagram, X)
    
    Returns:
        Dictionary with platform names as keys and lists of mentions as values
    """
    facebook_task = get_facebook_mentions(db)
    instagram_task = get_instagram_mentions(db)
    x_task = get_x_mentions(db)
    
    # Wait for all tasks to complete
    results = await asyncio.gather(
        facebook_task,
        instagram_task,
        x_task,
        return_exceptions=True  # Prevents one failure from stopping all
    )
    
    # Handle any exceptions
    facebook_mentions = []
    instagram_mentions = []
    x_mentions = []
    
    if not isinstance(results[0], Exception):
        facebook_mentions = results[0]
    
    if not isinstance(results[1], Exception):
        instagram_mentions = results[1]
    
    if not isinstance(results[2], Exception):
        x_mentions = results[2]
    
    return {
        "facebook": facebook_mentions,
        "instagram": instagram_mentions,
        "x": x_mentions
    }

