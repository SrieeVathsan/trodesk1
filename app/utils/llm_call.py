import requests
from app.core import config


async def llm_call(retrieved_text):
    # Your Groq API key
    groq_api_key = config.GROQ_API_KEY

    # Choose model available from Groq
    model = "llama3-8b-8192"

    # Define headers
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }

    # Create prompt
    # prompt = f"Format and summarize the following content:\n\n{retrieved_text}"
    systemPrompt = """You are a highly capable assistant that processes social media posts about a specific company. Your task is to analyze each message and return structured information in JSON format.

            For every input message:
            1. **Determine Sentiment**: Classify the sentiment as either `"positive"`, `"negative"`, or `"neutral"`.
            2. **Generate a Contextual Reply**: Write a short, empathetic, and context-aware response suitable for the company to reply with.
            3. **Assign Priority (only if sentiment is negative)**:
            - 1 = Critical (e.g., legal threats, serious safety issues, or public backlash)
            - 2 = High (e.g., product/service failure, strong dissatisfaction)
            - 3 = Medium (e.g., complaint, but not urgent)
            - 4 = Low (e.g., minor annoyance or suggestion)
            4. If the message is not negative, omit the `"priority"` field.

            Output the result in the following JSON format:

            ```json
            {
            "sentiment": "positive" | "negative" | "neutral",
            "reply": "Your context-aware reply here.",
            "priority": 1 | 2 | 3 | 4 // Only include if sentiment is negative
            }
            Be concise but accurate. Understand slang, sarcasm, and informal language. Base your reply tone on the sentiment—apologetic and helpful for negative, grateful and warm for positive.
            """
    # Construct payload
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": systemPrompt},
            {"role": "user", "content": f"Context: {retrieved_text}"}
        ],
        "temperature": 0.3,
        "max_tokens": 512
    }

    try:
        # Send request
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload
        )
        # print(f"Response: {response.text}")
        # Parse response
        result = response.json()
        print(f"LLM call result: {result}")
        return result
    
    except requests.exceptions.RequestException as e:
        print(f"Error during LLM call: {e}")
        return {"error": str(e)}
