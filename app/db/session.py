from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from contextlib import asynccontextmanager
from app.core.settings import get_settings

settings=get_settings()

DATABASE_URL = settings.DATABASE_URL
print("DATABASE URL: ",DATABASE_URL)

Base = declarative_base()

engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG, future=True)

async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

def get_sessionmaker():
    return async_session

def get_engine():
    return engine


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
