from fastapi import FastAPI, HTTPException
from httpx import AsyncClient
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.api.v1.endpoints.instagram.insta_api import router as insta_router
from app.api.v1.endpoints.facebook.facebook_api import router as facebook_router
from app.api.v1.endpoints.x.x_service import router as x_router
from app.api.v1.endpoints.analytics.analytics_api import router as analytics_router
from app.api.v1.endpoints.linkedin.linkedin_api import router as linkedin_router

from app.db.session import Base, get_engine
load_dotenv()
from app.core.config import ACCESS_TOKEN, FB_PAGE_ID, IG_USER_ID,PAGE_ACCESS_TOKEN,GRAPH

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insta_router)
app.include_router(facebook_router)
app.include_router(x_router)
app.include_router(analytics_router)
app.include_router(linkedin_router)

print("GRAPH-------->",GRAPH)
print("ACCess token----------------------->",ACCESS_TOKEN)
print("PAGE_TOKEN-------------------->",PAGE_ACCESS_TOKEN)

@app.on_event("startup")
async def startup_event():
    engine = get_engine()
    app.state.engine = engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.engine.dispose() 

from app.core.settings import get_settings
print("Settings loaded:", get_settings().model_dump())