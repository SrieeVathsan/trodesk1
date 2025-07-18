from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.mysql import VARCHAR
from app.db.session import Base


class Platform(Base):
    __tablename__ = "platforms"

    id = Column(String(36), primary_key=True)  # UUID or custom code (e.g. "x", "insta")
    name = Column(String(50), unique=True, nullable=False)

    posts = relationship("MentionPost", back_populates="platform")


class User(Base):
    __tablename__ = "users"

    id = Column(String(100), primary_key=True)  # platform-specific user ID
    username = Column(String(100))
    display_name = Column(String(100))
    platform_id = Column(String(36), ForeignKey("platforms.id"))

    posts = relationship("MentionPost", back_populates="user")
    platform = relationship("Platform")


class MentionPost(Base):
    __tablename__ = "mention_posts"

    id = Column(String(100), primary_key=True)  # platform-specific post ID
    platform_id = Column(String(36), ForeignKey("platforms.id"))
    user_id = Column(String(100), ForeignKey("users.id"))

    text = Column(Text)
    created_at = Column(DateTime)
    media_url = Column(Text, nullable=True)
    is_reply = Column(Boolean, default=False)
    replied_to_post_id = Column(String(100), nullable=True)
    reply_message = Column(Text, nullable=True)
    sentiment=Column(String(100),nullable=True)
    Ticket_resolved=Column(Boolean,default=False)

    platform = relationship("Platform", back_populates="posts")
    user = relationship("User", back_populates="posts")
