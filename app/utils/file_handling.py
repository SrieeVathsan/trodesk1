import aiofiles
import os

LAST_ID_FILE = "last_mention_id.txt"


async def read_last_id():
    if os.path.exists(LAST_ID_FILE):
        async with aiofiles.open(LAST_ID_FILE, mode="r") as f:
            return (await f.read()).strip()
    return None


async def save_last_id(tweet_id: str):
    async with aiofiles.open(LAST_ID_FILE, mode="w") as f:
        await f.write(tweet_id)
