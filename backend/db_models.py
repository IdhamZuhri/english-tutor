from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Analysis results (populated at the end of the session)
    grammar_score = Column(Integer, nullable=True)
    fluency_score = Column(Integer, nullable=True)
    vocabulary_score = Column(Integer, nullable=True)
    pronunciation_score = Column(Integer, nullable=True)
    filler_count = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    justifications = Column(JSON, nullable=True)
    
    messages = relationship("Message", back_populates="session")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    role = Column(String, index=True) # "user" or "assistant"
    content = Column(Text)
    corrections_json = Column(JSON, nullable=True) # To store corrections if role=="user"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("Session", back_populates="messages")
