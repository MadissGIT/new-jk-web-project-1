import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.app.api.dependencies.common import TourServiceDep
from src.app.api.dependencies.pagination import PaginationDep
from src.app.api.dependencies.users import get_current_guide_or_admin
from src.app.db.models.tour import (
    TourCreate,
    TourFormat,
    TourResponse,
    TourSlotCreate,
    TourSlotResponse,
    TourSlotsResponse,
    TourSlotUpdate,
    ToursPublic,
    TourStatus,
    TourStatusUpdate,
    TourUpdate,
)
from src.app.db.models.user import Role, User

router = APIRouter()
GuideOrAdminUser = Annotated[User, Depends(get_current_guide_or_admin)]


@router.get("", response_model=ToursPublic)
@router.get("/", response_model=ToursPublic, include_in_schema=False)
async def read_tours(
    tour_service: TourServiceDep,
    pagination: PaginationDep,
    city_id: str | None = None,
    date: datetime.date | None = None,
    format: TourFormat | None = None,
    language: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    duration_min: int | None = Query(default=None, ge=1),
    duration_max: int | None = Query(default=None, ge=1),
    wheelchair_accessible: bool | None = None,
) -> ToursPublic:
    return await tour_service.get_tours(
        page=pagination.page,
        limit=pagination.limit,
        city_id=city_id,
        date=date,
        format=format,
        language=language,
        min_price=min_price,
        max_price=max_price,
        duration_min=duration_min,
        duration_max=duration_max,
        wheelchair_accessible=wheelchair_accessible,
    )


@router.post("", response_model=TourResponse, status_code=201)
async def create_tour(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    tour_in: TourCreate,
) -> TourResponse:
    tour_payload = tour_in.model_copy(
        update={
            "guide_id": str(current_user.id),
            "guide_name": f"{current_user.name} {current_user.surname}".strip(),
        },
    )
    if current_user.role == Role.ADMIN:
        tour_payload.status = TourStatus.PUBLISHED
    else:
        tour_payload.status = TourStatus.MODERATION
    return await tour_service.create_tour(tour_payload)


@router.get("/me", response_model=ToursPublic)
async def read_my_tours(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    pagination: PaginationDep,
) -> ToursPublic:
    return await tour_service.get_my_tours(
        guide_id=current_user.id,
        page=pagination.page,
        limit=pagination.limit,
    )


@router.get("/{tour_id}", response_model=TourResponse)
async def read_tour(
    tour_service: TourServiceDep,
    tour_id: str,
) -> TourResponse:
    return await tour_service.get_tour(tour_id)


@router.get("/{tour_id}/slots", response_model=TourSlotsResponse)
async def read_tour_slots(
    tour_service: TourServiceDep,
    tour_id: str,
    date_from: datetime.datetime | None = None,
    date_to: datetime.datetime | None = None,
) -> TourSlotsResponse:
    return await tour_service.get_slots(
        tour_id=tour_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/{tour_id}/slots", response_model=TourSlotResponse, status_code=201)
async def create_tour_slot(
    tour_service: TourServiceDep,
    tour_id: str,
    slot_in: TourSlotCreate,
) -> TourSlotResponse:
    return await tour_service.create_slot(tour_id=tour_id, slot_in=slot_in)


@router.patch("/{tour_id}", response_model=TourResponse)
async def update_my_tour(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    tour_id: str,
    tour_in: TourUpdate,
) -> TourResponse:
    return await tour_service.update_my_tour(
        guide_id=current_user.id,
        tour_id=tour_id,
        tour_in=tour_in,
    )


@router.patch("/{tour_id}/slots/{slot_id}", response_model=TourSlotResponse)
async def update_my_tour_slot(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    tour_id: str,
    slot_id: str,
    slot_in: TourSlotUpdate,
) -> TourSlotResponse:
    return await tour_service.update_my_slot(
        guide_id=current_user.id,
        tour_id=tour_id,
        slot_id=slot_id,
        slot_in=slot_in,
    )


@router.post("/{tour_id}/slots/{slot_id}/close", response_model=TourSlotResponse)
async def close_my_tour_slot(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    tour_id: str,
    slot_id: str,
) -> TourSlotResponse:
    return await tour_service.close_my_slot(
        guide_id=current_user.id,
        tour_id=tour_id,
        slot_id=slot_id,
    )


@router.patch("/{tour_id}/status", response_model=TourResponse)
async def update_my_tour_status(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
    tour_id: str,
    status_in: TourStatusUpdate,
) -> TourResponse:
    return await tour_service.update_my_tour_status(
        guide_id=current_user.id,
        tour_id=tour_id,
        status_in=status_in,
    )
