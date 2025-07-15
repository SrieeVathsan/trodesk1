import os
from app.core.settings import get_settings

settings=get_settings()

PAGE_ACCESS_TOKEN=settings.PAGE_ACCESS_TOKEN
FB_PAGE_ID =settings.FB_PAGE_ID
IG_USER_ID = settings.IG_USER_ID
ACCESS_TOKEN =settings.ACCESS_TOKEN
GRAPH=settings.GRAPH
VERIFY_TOKEN = settings.VERIFY_TOKEN
# X_ACCESS_TOKEN = settings.X_ACCESS_TOKEN
# X_ACCESS_TOKEN_SECRET = settings.X_ACCESS_TOKEN_SECRET
# X_CONSUMER_KEY = settings.X_CONSUMER_KEY
# X_CONSUMER_SECRET = settings.X_CONSUMER_SECRET
# X_USER_ID = settings.X_USER_ID
# DATABASE_URL = settings.DATABASE_URL