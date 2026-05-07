from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime

class ServiceBase(BaseModel):
    name: str
    url: HttpUrl
    method: str = "GET"
    expected_status: int = 200
    is_active: bool = True

class ServiceCreate(ServiceBase):
    pass

class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PingHistoryResponse(BaseModel):
    id: int
    service_id: int
    timestamp: datetime
    latency_ms: float
    status_code: int
    is_up: bool

    class Config:
        from_attributes = True

class AlertResponse(BaseModel):
    id: int
    service_id: int
    timestamp: datetime
    message: str
    resolved: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True
