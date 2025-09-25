import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1.endpoints.instagram.insta_api import router as insta_router
from app.api.v1.endpoints.instagram.insta_webhook import router as insta_webhook_router
from app.api.v1.endpoints.facebook.facebook_api import router as facebook_router
from app.api.v1.endpoints.x.x_api import router as x_router
from app.api.v1.endpoints.analytics.analytics_api import router as analytics_router
from app.api.v1.endpoints.linkedin.linkedin_api import router as linkedin_router
from app.api.v1.endpoints.all_apis.all_api import router as all_router
from app.react.react_agent import run_react_agent
from app.core.settings import get_settings

settings=get_settings()

from app.db.session import Base, get_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP logic
    engine = get_engine()
    app.state.engine = engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_react_agent()
    print("Acess token:✅✅✅",settings.ACCESS_TOKEN)

    yield
   
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
app.include_router(insta_webhook_router)
app.include_router(insta_router)
app.include_router(facebook_router)
app.include_router(x_router)
app.include_router(analytics_router)
app.include_router(linkedin_router)
app.include_router(all_router)




from fastapi.staticfiles import StaticFiles

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
