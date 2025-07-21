from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.autonomous_reply_service import autonomous_service

router = APIRouter(tags=["Autonomous Reply Service"])

@router.post("/autonomous/start")
async def start_autonomous_service():
    """Start the autonomous reply service."""
    if autonomous_service.is_running:
        return {"status": "already_running", "message": "Autonomous service is already running"}
    
    # Start the service in background
    import asyncio
    asyncio.create_task(autonomous_service.start_autonomous_service())
    
    return {"status": "started", "message": "Autonomous reply service started"}

@router.post("/autonomous/stop")
async def stop_autonomous_service():
    """Stop the autonomous reply service."""
    if not autonomous_service.is_running:
        return {"status": "not_running", "message": "Autonomous service is not running"}
    
    autonomous_service.stop_autonomous_service()
    return {"status": "stopped", "message": "Autonomous reply service stopped"}

@router.get("/autonomous/status")
async def get_autonomous_status():
    """Get the status of the autonomous reply service."""
    return {
        "status": "running" if autonomous_service.is_running else "stopped",
        "is_running": autonomous_service.is_running
    }

@router.post("/autonomous/run-once")
async def run_autonomous_cycle_once(db: AsyncSession = Depends(get_db)):
    """Run one autonomous cycle manually (for testing)."""
    try:
        # Fetch all mentions
        await autonomous_service.fetch_all_mentions(db)
        
        # Process unreplied mentions
        result = await autonomous_service.process_unreplied_mentions(db)
        
        return {
            "status": "success",
            "message": "Autonomous cycle completed",
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error running autonomous cycle: {str(e)}"
        }
