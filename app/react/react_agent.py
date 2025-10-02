import json
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain.chat_models import init_chat_model
from app.tools.api_fetch_mention import fetch_mentions_and_unreplied_mentions
from app.tools.send_platform_reply import send_platform_response
from app.tools.mark_sentiment import mark_sentiment
from app.tools.ticket_raising import raise_the_ticket
from langchain.tools import tool
from app.db.session import async_session
import os
from app.core.config import GROQ_API_KEY
from app.core.config import get_settings
from langchain_groq import ChatGroq

settings = get_settings()


@tool
async def fetch_mentions_tool(query: str = "") -> str:
    """Fetch mentions from all platforms and return unreplied mentions."""
    async with async_session() as db:
        result = await fetch_mentions_and_unreplied_mentions(db)
        return json.dumps(result)

@tool  
async def mark_sentiment_tool(sentiment_data: str) -> str:
    """Mark sentiment for mentions. Input should be JSON string like '[{"id":"123","sentiment":"positive"}]'"""
    async with async_session() as db:
        result = await mark_sentiment(db, sentiment_data)
        return json.dumps(result)

@tool
async def send_reply_tool(reply_data: str) -> str:
    """Send reply to mention. Input should be JSON like '{"mention_id":"123","reply_text":"Thank you!","platform":"instagram"}'"""
    async with async_session() as db:
        reply_dict = json.loads(reply_data)
        result = await send_platform_response(db, reply_dict)
        return json.dumps(result)

@tool
async def raise_ticket_tool(input_data: str = "") -> str:
    """Raise tickets for negative mentions."""
    async with async_session() as db:
        result = await raise_the_ticket(db)
        return json.dumps(result)

api_key = settings.GROQ_API_KEY
chat_model=ChatGroq(api_key=api_key, model="llama-3.1-8b-instant", temperature=0)

memory = MemorySaver()

# chat_model = init_chat_model("gpt-4o-mini")

tools = [fetch_mentions_tool, mark_sentiment_tool, send_reply_tool, raise_ticket_tool]
agent = create_react_agent(model=chat_model, checkpointer=memory, tools=tools)

config = RunnableConfig(configurable={"thread_id": "1"})

async def run_react_agent():
    input_message = {
        "messages": [
            {
                "role": "system",
                "content": """You are a Social Media Manager. Follow this EXACT workflow:

                1. First fetch mentions using fetch_mentions_tool
                2. Analyze each mention's sentiment manually (positive, neutral, negative)
                3. Use mark_sentiment_tool to save ALL sentiments to database
                4. IMPORTANT: For negative mentions, ALWAYS use raise_ticket_tool to create support tickets
                5. Send replies using send_reply_tool for ALL mentions:
                - POSITIVE: Thank you messages with enthusiasm
                - NEGATIVE: Apologetic messages mentioning team will contact them
                - NEUTRAL: Helpful, informative replies
                6. Continue until all mentions are processed

                CRITICAL: Never skip the ticket raising step for negative mentions. Always call raise_ticket_tool after marking negative sentiments."""
            },
            {
                "role": "user", 
                "content": "Process all unreplied social media mentions: fetch, analyze sentiment, mark in database, raise tickets for negative mentions, and send appropriate replies"
            }
        ]
    }

    async for step in agent.astream(input_message, config=config, stream_mode="values"):
        if "messages" in step:
            print("🗣️ Agent:", step["messages"][-1].content)
        elif "tool" in step:
            print("🔧 Tool Call:", step["tool"])





