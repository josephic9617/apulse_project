from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from . import models, schemas, database
from fastapi.middleware.cors import CORSMiddleware
import datetime

app = FastAPI(title="API Monitoring Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

@app.post("/api/services", response_model=schemas.ServiceResponse)
async def create_service(service: schemas.ServiceCreate, db: AsyncSession = Depends(database.get_db)):
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

@app.get("/api/services", response_model=List[schemas.ServiceResponse])
async def list_services(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Service))
    return result.scalars().all()

@app.get("/api/services/{service_id}/metrics", response_model=List[schemas.PingHistoryResponse])
async def get_metrics(service_id: int, limit: int = 50, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.PingHistory)
        .where(models.PingHistory.service_id == service_id)
        .order_by(models.PingHistory.timestamp.desc())
        .limit(limit)
    )
    return result.scalars().all()[::-1]

@app.get("/api/alerts", response_model=List[schemas.AlertResponse])
async def get_alerts(limit: int = 20, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Alert).order_by(models.Alert.timestamp.desc()).limit(limit))
    return result.scalars().all()

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(database.get_db)):
    services = await db.execute(select(models.Service))
    services_count = len(services.scalars().all())
    
    alerts = await db.execute(select(models.Alert).where(models.Alert.resolved == False))
    open_alerts_count = len(alerts.scalars().all())
    
    # Calculate true uptime for last 24h
    import datetime
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
async def delete_service(service_id: int, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Service).where(models.Service.id == service_id))
    service = result.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    await db.delete(service)
    await db.commit()
    return {"status": "deleted"}

class ServiceUpdate(schemas.BaseModel):
    is_active: bool

@app.patch("/api/services/{service_id}")
async def update_service(service_id: int, update_data: ServiceUpdate, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Service).where(models.Service.id == service_id))
    service = result.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.is_active = update_data.is_active
    await db.commit()
    return {"status": "updated", "is_active": service.is_active}

@app.patch("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Alert).where(models.Alert.id == alert_id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    await db.commit()
    return {"status": "resolved"}
