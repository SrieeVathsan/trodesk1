from pydantic import BaseModel

class ReplyRequest(BaseModel):
    media_id: str
    comment_text: str