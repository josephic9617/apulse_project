from celery import Celery
import asyncio
import httpx
from datetime import datetime
from sqlalchemy.future import select
from .database import SessionLocal
from .models import Service, PingHistory, Alert

celery_app = Celery("tasks", broker="redis://localhost:6379/0", backend="redis://localhost:6379/0")

celery_app.conf.beat_schedule = {
    'ping-all-services': {
        'task': 'app.tasks.ping_services',
        'schedule': 30.0,
    },
    'cleanup-old-pings': {
        'task': 'app.tasks.cleanup_pings',
        'schedule': 86400.0,  # Once a day
    },
}
celery_app.conf.timezone = 'UTC'

async def async_ping_services():
    async with SessionLocal() as db:
        result = await db.execute(select(Service).where(Service.is_active == True))
        services = result.scalars().all()
        
        async with httpx.AsyncClient() as client:
            for service in services:
                start_time = datetime.utcnow()
                try:
                    request_method = getattr(client, service.method.lower(), client.get)
                    response = await request_method(service.url, timeout=5.0)
                    latency = (datetime.utcnow() - start_time).total_seconds() * 1000
                    is_up = response.status_code == service.expected_status
                    status_code = response.status_code
                except Exception as e:
                    latency = 0.0
                    is_up = False
                    status_code = 0
                
                ping = PingHistory(
                    service_id=service.id,
                    latency_ms=latency,
                    status_code=status_code,
                    is_up=is_up
                )
                db.add(ping)
                
                if not is_up:
                    # check if there's already an open alert
                    open_alert = await db.execute(
                        select(Alert).where(Alert.service_id == service.id, Alert.resolved == False)
                    )
                    if not open_alert.scalars().first():
                        alert = Alert(
                            service_id=service.id,
                            message=f"Service {service.name} returned {status_code} (Expected {service.expected_status})",
                        )
                        db.add(alert)
                    
        await db.commit()

@celery_app.task
def ping_services():
    asyncio.run(async_ping_services())

async def async_cleanup_pings():
    async with SessionLocal() as db:
        seven_days_ago = datetime.utcnow() - datetime.timedelta(days=7)
        # We need to import timedelta from datetime, I will add it to imports
        # Actually I can just use datetime.utcnow() directly if imported correctly
        pass # implemented below

@celery_app.task
def cleanup_pings():
    import datetime
    async def _clean():
        async with SessionLocal() as db:
            from sqlalchemy import delete
            seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
            await db.execute(delete(PingHistory).where(PingHistory.timestamp < seven_days_ago))
            await db.commit()
    asyncio.run(_clean())
