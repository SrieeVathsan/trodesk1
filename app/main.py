from fastapi import FastAPI, HTTPException
from httpx import AsyncClient
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.api.v1.endpoints.instagram.insta_service import router as insta_router
from app.api.v1.endpoints.facebook.facebook_service import router as facebook_router
import requests
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

print("GRAPH-------->",GRAPH)
print("ACCess token----------------------->",ACCESS_TOKEN)
print("PAGE_TOKEN-------------------->",PAGE_ACCESS_TOKEN)

