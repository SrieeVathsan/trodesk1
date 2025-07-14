import os
from app.core.settings import get_settings

settings=get_settings()

PAGE_ACCESS_TOKEN=settings.PAGE_ACCESS_TOKEN
FB_PAGE_ID =settings.FB_PAGE_ID
IG_USER_ID = settings.IG_USER_ID
ACCESS_TOKEN =settings.ACCESS_TOKEN
GRAPH=settings.GRAPH
VERIFY_TOKEN = settings.VERIFY_TOKEN