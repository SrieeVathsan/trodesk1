import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from app.api.v1.endpoints.instagram.insta_api import router as insta_router
from app.api.v1.endpoints.facebook.facebook_api import router as facebook_router
from app.api.v1.endpoints.x.x_api import router as x_router
from app.api.v1.endpoints.analytics.analytics_api import router as analytics_router
from app.api.v1.endpoints.linkedin.linkedin_api import router as linkedin_router
from app.api.v1.endpoints.all_apis.all_api import router as all_router
from app.api.v1.endpoints.autonomous.autonomous_api import router as autonomous_router
import requests
from app.react.agent import run

from app.db.session import Base, get_engine
from app.core.config import ACCESS_TOKEN, FB_PAGE_ID, IG_USER_ID, PAGE_ACCESS_TOKEN, GRAPH
from app.tasks.background_tasks import task_manager
from app.core.logger import app_logger  # Use existing logger

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP logic
    engine = get_engine()
    app.state.engine = engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start the agent as a background task (non-blocking)
    app.state.agent_task = asyncio.create_task(
        run("Fetch recent brand mentions across connected platforms,Perform sentiment analysis on each mention,Return structured data with mentions")
    )
    
    # Start background tasks
    # await task_manager.start_background_tasks()

    yield

    # SHUTDOWN logic
    # Cancel agent task if still running
    if hasattr(app.state, 'agent_task') and not app.state.agent_task.done():
        app.state.agent_task.cancel()
        try:
            await app.state.agent_task
        except asyncio.CancelledError:
            pass
    
    # await task_manager.stop_background_tasks()
    await app.state.engine.dispose()


app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(insta_router)
app.include_router(facebook_router)
app.include_router(x_router)
app.include_router(analytics_router)
app.include_router(linkedin_router)
app.include_router(all_router)
app.include_router(autonomous_router)

print("GRAPH-------->",GRAPH)
print("ACCess token----------------------->",ACCESS_TOKEN)
print("PAGE_TOKEN-------------------->",PAGE_ACCESS_TOKEN)




# Remove the asyncio.run() call - it should not be at module level
# If you need to run this task, do it in the lifespan function or as a background task
# Removed asyncio.run() call from module level to prevent event loop conflicts