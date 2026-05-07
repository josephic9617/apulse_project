from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String)
    method = Column(String, default="GET")
    expected_status = Column(Integer, default=200)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    pings = relationship("PingHistory", back_populates="service", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="service", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class PingHistory(Base):
    __tablename__ = "ping_history"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    latency_ms = Column(Float)
    status_code = Column(Integer)
    is_up = Column(Boolean)

    service = relationship("Service", back_populates="pings")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    message = Column(String)
    resolved = Column(Boolean, default=False)

    service = relationship("Service", back_populates="alerts")
