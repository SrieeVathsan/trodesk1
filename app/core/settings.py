from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

env_type = os.getenv("ENV", "development")

env_file_map = {
    "development": ".env.dev",
    "uat": ".env.uat",
    "production": ".env.prod"
}

load_dotenv(dotenv_path=env_file_map.get(env_type, ".env.dev"))

class Settings(BaseSettings):
    ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    VERIFY_TOKEN:str
    PAGE_ACCESS_TOKEN:str
    ACCESS_TOKEN:str
    IG_USER_ID:int
    FB_PAGE_ID:int
    GRAPH:str
    X_ACCESS_TOKEN: str
    X_ACCESS_TOKEN_SECRET: str
    X_CONSUMER_KEY: str
    X_CONSUMER_SECRET: str
    X_USER_ID: int
    DATABASE_URL: str
    
    class Config:
        env_file_encoding = 'utf-8'


@lru_cache()
def get_settings():
    return Settings()
