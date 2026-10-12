from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import MonitoringTarget
from app.schemas.schemas import (
    MonitoringTargetCreate,
    MonitoringTargetResponse,
    MonitoringTargetUpdate,
)

router = APIRouter(prefix="/targets", tags=["Targets"])


@router.get("", response_model=List[MonitoringTargetResponse])
async def list_targets(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all registered network monitoring targets."""
    stmt = select(MonitoringTarget).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=MonitoringTargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    payload: MonitoringTargetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create and register a new monitoring target."""
    target = MonitoringTarget(
        name=payload.name,
        host=payload.host,
        target_type=payload.target_type,
        port=payload.port,
        enabled=payload.enabled,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("/{target_id}", response_model=MonitoringTargetResponse)
async def get_target(
    target_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Fetch details of a single monitoring target by ID."""
    stmt = select(MonitoringTarget).where(MonitoringTarget.id == target_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target with id {target_id} not found",
        )
    return target


@router.put("/{target_id}", response_model=MonitoringTargetResponse)
async def update_target(
    target_id: int,
    payload: MonitoringTargetUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update settings of an existing monitoring target."""
    stmt = select(MonitoringTarget).where(MonitoringTarget.id == target_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target with id {target_id} not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(target, field_name, value)

    target.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(
    target_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a monitoring target and its associated session history."""
    stmt = select(MonitoringTarget).where(MonitoringTarget.id == target_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target with id {target_id} not found",
        )

    await db.delete(target)
    await db.commit()
    return None
