import asyncio
from app.services.autonomous_reply_service import autonomous_service
from app.core.logger import app_logger as logger

class BackgroundTaskManager:
    def __init__(self):
        self.autonomous_task = None
        
    async def start_background_tasks(self):
        """Start all background tasks."""
        try:
            # Start autonomous reply service
            self.autonomous_task = asyncio.create_task(
                autonomous_service.start_autonomous_service()
            )
            logger.info("Background tasks started successfully")
            
        except Exception as e:
            logger.error(f"Error starting background tasks: {e}")
    
    async def stop_background_tasks(self):
        """Stop all background tasks."""
        try:
            # Stop autonomous service
            autonomous_service.stop_autonomous_service()
            
            # Cancel the task
            if self.autonomous_task and not self.autonomous_task.done():
                self.autonomous_task.cancel()
                try:
                    await self.autonomous_task
                except asyncio.CancelledError:
                    pass
                    
            logger.info("Background tasks stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping background tasks: {e}")

# Global instance
task_manager = BackgroundTaskManager()
