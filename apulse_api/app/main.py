import asyncio
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from . import models, schemas, database, auth
from typing import List
import datetime

app = FastAPI(title="APulse API")

@app.on_event("startup")
async def startup():
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    
    # Create default user if not exists
    async with database.SessionLocal() as db:
        result = await db.execute(select(models.User).where(models.User.username == "admin"))
        user = result.scalars().first()
        if not user:
            hashed_password = auth.get_password_hash("admin123")
            new_user = models.User(username="admin", hashed_password=hashed_password)
            db.add(new_user)
            await db.commit()

# Authentication Endpoints
@app.post("/api/auth/login", response_model=schemas.Token)
async def login(form_data: schemas.UserCreate, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.User).where(models.User.username == form_data.username))
    user = result.scalars().first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Protected Endpoints
@app.get("/api/services", response_model=List[schemas.ServiceResponse])
async def get_services(db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    result = await db.execute(select(models.Service))
    return result.scalars().all()

@app.post("/api/services", response_model=schemas.ServiceResponse)
async def create_service(service: schemas.ServiceCreate, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_service = models.Service(
        name=service.name, 
        url=str(service.url), 
        method=service.method,
        expected_status=service.expected_status,
        is_active=service.is_active
    )
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    services = await db.execute(select(models.Service))
    services_count = len(services.scalars().all())
    
    alerts = await db.execute(select(models.Alert).where(models.Alert.resolved == False))
    open_alerts_count = len(alerts.scalars().all())
    
    # Calculate true uptime for last 24h
    yesterday = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    recent_pings = await db.execute(select(models.PingHistory).where(models.PingHistory.timestamp > yesterday))
    all_pings = recent_pings.scalars().all()
    
    if len(all_pings) > 0:
        up_pings = sum(1 for p in all_pings if p.is_up)
        uptime_percentage = round((up_pings / len(all_pings)) * 100, 2)
    else:
        uptime_percentage = 100.0
    
    return {
        "total_services": services_count,
        "open_alerts": open_alerts_count,
        "uptime_percentage": uptime_percentage
    }

@app.delete("/api/services/{service_id}")
async def delete_service(service_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    await db.execute(delete(models.Service).where(models.Service.id == service_id))
    await db.commit()
    return {"status": "deleted"}

@app.patch("/api/services/{service_id}")
async def update_service(service_id: int, service_update: dict, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    result = await db.execute(select(models.Service).where(models.Service.id == service_id))
    db_service = result.scalars().first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    for key, value in service_update.items():
        setattr(db_service, key, value)
    
    await db.commit()
    return db_service

@app.get("/api/services/{service_id}/metrics", response_model=List[schemas.PingHistoryResponse])
async def get_service_metrics(service_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    result = await db.execute(
        select(models.PingHistory)
        .where(models.PingHistory.service_id == service_id)
        .order_by(models.PingHistory.timestamp.desc())
        .limit(50)
    )
    return result.scalars().all()

@app.get("/api/alerts", response_model=List[schemas.AlertResponse])
async def get_alerts(db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    result = await db.execute(select(models.Alert).order_by(models.Alert.timestamp.desc()).limit(50))
    return result.scalars().all()

@app.patch("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    result = await db.execute(select(models.Alert).where(models.Alert.id == alert_id))
    alert = result.scalars().first()
    if alert:
        alert.resolved = True
        await db.commit()
    return {"status": "resolved"}
