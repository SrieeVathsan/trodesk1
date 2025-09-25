from pydantic import BaseModel
from typing import Optional,List
class PostRequest(BaseModel):
    text: str

class CommentRequest(BaseModel):
    text: str
    mention_attrs: Optional[List[dict]] = None

class MessageRequest(BaseModel):
    text: str

class PaginationParams:
    def __init__(self, start: int = 0, count: int = 20):
        self.start = start
        self.count = count