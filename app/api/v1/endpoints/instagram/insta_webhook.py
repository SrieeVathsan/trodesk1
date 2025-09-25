from fastapi import APIRouter, Request, BackgroundTasks, HTTPException,Depends
from fastapi.responses import JSONResponse
from app.services.insta_service import verify_instagram_webhook,handle_instagram_webhook
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import app_logger


router=APIRouter(tags="Insta-Webhook")

@router.get("/insta/webhook")
async def verify_webhook():
    try:
        await verify_instagram_webhook(request=Request)
    except Exception as e:
        app_logger.info(f"Error while verifying webhook {e}")

@router.post("/insta/webhook")
async def handling_webhook():
    try:
        await handle_instagram_webhook(request=Request,background_tasks=BackgroundTasks)
    except Exception as e:
        app_logger.info(f"Error while handling instagram webhook")
