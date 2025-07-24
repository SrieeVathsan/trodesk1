from app.utils.file_handling import write_to_file,read_file
from app.core.logger import app_logger as logger
from pydantic import BaseModel
from typing import Callable, Awaitable
from pydantic import Field 
from typing import Union
from typing import List 
from typing import Dict 
from enum import Enum
from enum import auto
import json
import asyncio
from groq import AsyncGroq
from openai import AsyncOpenAI
from app.core.config import GROQ_API_KEY
from app.tools.api_fetch_mention import fetch_mentions_and_unreplied_mentions
from app.tools.mark_sentiment import mark_sentiment
from app.tools.send_platform_reply import send_platform_response
from app.tools.sentiment_analysis import process_unreplied_mentions
from app.tools.ticket_raising import raise_the_ticket

client = AsyncGroq(api_key=GROQ_API_KEY)




Observation = Union[str, Exception]

PROMPT_TEMPLATE_PATH = "./data/input/react.txt"
OUTPUT_TRACE_PATH = "./data/output/trace.txt"

class Name(Enum):
    """
    Enumeration for tool names available to the agent.
    """
    FETCHING = auto()
    MARK_SENTIMENT = auto()
    SENDING_REPLY = auto()
    TICKET_RAISING=auto()
    # SENTIMENT_ANALYSIS = auto()
    # NONE= auto()

    def __str__(self) -> str:
        """
        String representation of the tool name.
        """
        return self.name.lower()


class Choice(BaseModel):
    """
    Represents a choice of tool with a reason for selection.
    """
    name: Name = Field(..., description="The name of the tool chosen.")
    reason: str = Field(..., description="The reason for choosing this tool.")


class Message(BaseModel):
    """
    Represents a message with sender role and content.
    """
    role: str = Field(..., description="The role of the message sender.")
    content: str = Field(..., description="The content of the message.")


class Tool:
    """
    A wrapper class for tools used by the agent, executing a function based on tool type.
    """

    def __init__(self, name: Name, func: Callable[..., Awaitable[str]]):
        """
        Initializes a Tool with a name and an associated async function.
        
        Args:
            name (Name): The name of the tool.
            func (Callable[..., Awaitable[str]]): The async function associated with the tool.
        """
        self.name = name
        self.func = func

    async def use(self, task: str, *args, **kwargs) -> Observation:
        """
        Executes the tool's async function with the provided task.

        Args:
            task (str): The input task for the tool.
            *args: Additional positional arguments for the tool function.
            **kwargs: Additional keyword arguments for the tool function.

        Returns:
            Observation: Result of the tool's function or an error message if an exception occurs.
        """
        try:
            return await self.func(task, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error executing tool {self.name}: {e}")
            return str(e)


class Agent:
    """
    Defines the agent responsible for executing queries and handling tool interactions.
    """

    def __init__(self, model: None) -> None:
        """
        Initializes the Agent with a generative model, tools dictionary, and a messages log.

        Args:
            model (GenerativeModel): The generative model used by the agent.
        """
        self.model = model
        self.tools: Dict[Name, Tool] = {}
        self.messages: List[Message] = []
        self.task = ""
        self.max_iterations = 10
        self.current_iteration = 0
        self.template = self.load_template()

    def load_template(self) -> str:
        """
        Loads the prompt template from a file.

        Returns:
            str: The content of the prompt template file.
        """
        return read_file(PROMPT_TEMPLATE_PATH)

    def register(self, name: Name, func: Callable[..., Awaitable[str]]) -> None:
        """
        Registers an async tool to the agent.

        Args:
            name (Name): The name of the tool.
            func (Callable[..., Awaitable[str]]): The async function associated with the tool.
        """
        self.tools[name] = Tool(name, func)

    def trace(self, role: str, content: str) -> None:
        """
        Logs the message with the specified role and content and writes to file.

        Args:
            role (str): The role of the message sender.
            content (str): The content of the message.
        """
        if role != "system":
            self.messages.append(Message(role=role, content=content))
        write_to_file(path=OUTPUT_TRACE_PATH, content=f"{role}: {content}\n")

    def get_history(self) -> str:
        """
        Retrieves the conversation history.

        Returns:
            str: Formatted history of messages.
        """
        return "\n".join([f"{message.role}: {message.content}" for message in self.messages])

    async def think(self) -> None:
        """
        Processes the current task, decides actions, and iterates until a solution or max iteration limit is reached.
        """
        self.current_iteration += 1
        logger.info(f"Starting iteration {self.current_iteration}")
        write_to_file(path=OUTPUT_TRACE_PATH, content=f"\n{'='*50}\nIteration {self.current_iteration}\n{'='*50}\n")

        if self.current_iteration > self.max_iterations:
            logger.warning("Reached maximum iterations. Stopping.")
            self.trace("assistant", "I'm sorry, but I couldn't find a satisfactory answer within the allowed number of iterations. Here's what I know so far: " + self.get_history())
            return

        prompt = self.template.format(
            task=self.task, 
            history=self.get_history(),
            tools=', '.join([str(tool.name) for tool in self.tools.values()])
        )

        response = await self.ask_groq(prompt)
        logger.info(f"Thinking => {response}")
        self.trace("assistant", f"Thought: {response}")
        await self.decide(response)

    async def decide(self, response: str) -> None:
        """
        Processes the agent's response, deciding actions or final answers.

        Args:
            response (str): The response generated by the model.
        """
        try:
            response = response.strip()
            logger.info(f"Processing LLM response: {response[:200]}...")  # Debug log
            
            # First try to parse as JSON (current LLM behavior)
            if response.startswith('{') and response.endswith('}'):
                try:
                    parsed_response = json.loads(response)
                    
                    if "action" in parsed_response:
                        action = parsed_response["action"]
                        action_name = action.get("name", "").lower()
                        
                        # Map action names to enum values
                        action_mapping = {
                            "fetching": Name.FETCHING,
                            "api_fetch_mention": Name.FETCHING,
                            "fetch_mentions": Name.FETCHING,
                            "mark_sentiment": Name.MARK_SENTIMENT,
                            "send_reply": Name.SENDING_REPLY,
                            "ticket_raising": Name.TICKET_RAISING,
                            # "sentiment_analysis": Name.SENTIMENT_ANALYSIS,
                            # "send_platform_reply": Name.SENDING_REPLY,
                        }
                        
                        tool_name = action_mapping.get(action_name)
                        if tool_name:
                            self.trace("assistant", f"Action: Using {tool_name} tool")
                            input_data = action.get("input", self.task)
                            await self.act(tool_name, str(input_data))
                        else:
                            logger.warning(f"Unknown tool in JSON: {action_name}")
                            self.trace("assistant", "I encountered an unknown tool. Let me try again.")
                            await self.think()
                    elif "Final Answer" in response or "Answer:" in response:
                        self.trace("assistant", f"Final Answer: {response}")
                        return  # Exit without thinking again
                    else:
                        # Continue thinking if no clear action or answer
                        self.trace("assistant", "I encountered an unexpected error. Let me try a different approach.")
                        await self.think()
                    return
                        
                except json.JSONDecodeError:
                    # Fall through to text-based parsing
                    pass
            
            # Parse text-based format - look for specific patterns
            if "Action:" in response and "Action Input:" in response:
                # Extract action information
                lines = response.split('\n')
                action_line = None
                action_input_line = None
                
                for line in lines:
                    line = line.strip()
                    if line.startswith("Action:"):
                        action_line = line.replace("Action:", "").strip()
                    elif line.startswith("Action Input:"):
                        action_input_line = line.replace("Action Input:", "").strip()
                
                # Map action names to enum values
                action_mapping = {
                    "fetching": Name.FETCHING,
                    "api_fetch_mention": Name.FETCHING,
                    "fetch_mentions": Name.FETCHING,
                    "mark_sentiment": Name.MARK_SENTIMENT,
                    "send_reply": Name.SENDING_REPLY,
                    "ticket_raising": Name.TICKET_RAISING,
                    # "sentiment_analysis": Name.SENTIMENT_ANALYSIS,
                    # "send_platform_reply": Name.SENDING_REPLY
                }
                
                if action_line:
                    logger.info(f"Extracted action: {action_line}")  # Debug log
                    tool_name = action_mapping.get(action_line.lower())
                    if tool_name:
                        self.trace("assistant", f"Action: Using {tool_name} tool")
                        input_data = action_input_line if action_input_line else self.task
                        await self.act(tool_name, input_data)
                        return  # Exit without thinking again immediately
                    else:
                        logger.warning(f"Unknown tool: {action_line}")
                        self.trace("assistant", "I encountered an unknown tool. Let me try again.")
                        await self.think()
                        return
            elif "Final Answer" in response or "Answer:" in response:
                self.trace("assistant", f"Final Answer: {response}")
                return  # Exit without thinking again
            else:
                # Check if the response contains fabricated results or reasoning
                if any(keyword in response.lower() for keyword in ["result:", "observation:", "next step"]):
                    logger.warning("LLM generated fabricated results instead of using proper format")
                    self.trace("assistant", "Please use the proper format: 'Thought:', 'Action:', 'Action Input:' or 'Answer:'")
                    await self.think()
                    return
                
                # Continue thinking if no clear action or answer
                logger.warning(f"Could not parse response format: {response[:100]}...")
                self.trace("assistant", "I need to use the proper format. Let me try again.")
                await self.think()
                
        except Exception as e:
            logger.error(f"Error processing response: {str(e)}")
            self.trace("assistant", "I encountered an unexpected error. Let me try a different approach.")
            await self.think()

    async def act(self, tool_name: Name, task: str) -> None:
        """
        Executes the specified tool's function on the task and logs the result.

        Args:
            tool_name (Name): The tool to be used.
            task (str): The task for the tool.
        """
        tool = self.tools.get(tool_name)
        if tool:
            # Pass database session for tools that need it
            from app.db.session import async_session
            import json
            async with async_session() as db:
                try:
                    if tool_name == Name.FETCHING:
                        # Call the tool's function directly with db parameter
                        result = await tool.func(db)  # fetch_mentions_and_unreplied_mentions only needs db
                    elif tool_name == Name.MARK_SENTIMENT:
                        # Pass the task input directly to mark_sentiment function
                        # It will handle JSON parsing internally
                        result = await tool.func(db, task)
                    elif tool_name == Name.SENDING_REPLY:
                        # Parse the task input for reply data
                        import json
                        try:
                            # Expect JSON format for reply data
                            reply_data = json.loads(task)
                            result = await tool.func(db, reply_data)
                        except json.JSONDecodeError:
                            result = {"error": "Invalid input format. Expected JSON with mention_id and reply_text"}
                    elif tool_name == Name.TICKET_RAISING:
                        # Ticket raising only needs db parameter
                        result = await tool.func(db)
                    else:
                        result = await tool.use(task)
                        
                    observation = f"Observation from {tool_name}: {result}"
                    self.trace("system", observation)
                    self.messages.append(Message(role="system", content=observation))  # Add observation to message history
                    await self.think()
                except Exception as e:
                    logger.error(f"Error executing tool {tool_name}: {e}")
                    observation = f"Error with {tool_name}: {str(e)}"
                    self.trace("system", observation)
                    await self.think()
        else:
            logger.error(f"No tool registered for choice: {tool_name}")
            self.trace("system", f"Error: Tool {tool_name} not found")
            await self.think()

    async def execute(self, task: str) -> str:
        """
        Executes the agent's task-processing workflow.

        Args:
            task (str): The task to be processed.

        Returns:
            str: The final answer or last recorded message content.
        """
        self.task = task
        self.trace(role="user", content=task)
        await self.think()
        return self.messages[-1].content

    async def ask_groq(self, prompt: str) -> str:
        """
        Queries the generative model with a prompt.

        Args:
            prompt (str): The prompt text for the model.

        Returns:
            str: The model's response as a string.
        """
        try:
            response = await client.chat.completions.create(
                model="deepseek-r1-distill-llama-70b",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4
                # Removed response_format as Groq doesn't support JSON mode
            )
            return response.choices[0].message.content if response.choices else "No response from Groq"
        except Exception as e:
            logger.error(f"Error calling Groq API: {e}")
            return f"Error: {str(e)}"

async def run(task: str) -> str:
    """
    Sets up the agent, registers tools, and executes a task.

    Args:
        task (str): The task to execute.

    Returns:
        str: The agent's final answer.
    """
    groq = client

    agent = Agent(model=groq)
    
    agent.register(Name.FETCHING, fetch_mentions_and_unreplied_mentions)
    agent.register(Name.MARK_SENTIMENT,mark_sentiment)
    agent.register(Name.SENDING_REPLY, send_platform_response)
    agent.register(Name.TICKET_RAISING, raise_the_ticket)
    # agent.register(Name.SENTIMENT_ANALYSIS, process_unreplied_mentions)

    answer = await agent.execute(task)
    return answer

if __name__ == "__main__":
    result = asyncio.run(run("Fetch recent brand mentions across connected platforms,Perform sentiment analysis on each mention,Return structured data with mentions"))
    print("Final Agent Result:", result)



    