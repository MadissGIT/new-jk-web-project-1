import datetime
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from src.app.api.dependencies.common import (
    BookingServiceDep,
    ReviewServiceDep,
    TourServiceDep,
    UserServiceDep,
)
from src.app.api.dependencies.pagination import PaginationDep
from src.app.api.dependencies.users import CurrentUser, UserOr404, get_current_guide_or_admin
from src.app.db.models.booking import (
    BookingCancelResponse,
    BookingResponse,
    GuideBookingsPublic,
    BookingStatus,
)
from src.app.db.models.guide_application import GuideApplicationCreate, GuideApplicationResponse
from src.app.db.models.guide_profile import (
    GuideProfileResponse,
    GuideProfileUpdate,
    GuidePublicProfileResponse,
    GuideStatsResponse,
)
from src.app.db.models.review import ReviewsPublic
from src.app.db.models.user import User

router = APIRouter()
GuideOrAdminUser = Annotated[User, Depends(get_current_guide_or_admin)]


@router.get("/me", response_model=GuideProfileResponse)
async def read_guide_profile_me(
    user_service: UserServiceDep,
    current_user: GuideOrAdminUser,
) -> GuideProfileResponse:
    return await user_service.get_guide_profile(user_id=current_user.id)


@router.post("/apply", response_model=GuideApplicationResponse, status_code=201)
async def apply_for_guide(
    user_service: UserServiceDep,
    current_user: CurrentUser,
    application_in: GuideApplicationCreate,
) -> GuideApplicationResponse:
    return await user_service.apply_for_guide(
        user_id=current_user.id,
        application_in=application_in,
    )


@router.get("/applications/me/latest", response_model=GuideApplicationResponse)
async def read_latest_guide_application_me(
    user_service: UserServiceDep,
    current_user: CurrentUser,
) -> GuideApplicationResponse:
    return await user_service.get_latest_guide_application_for_user(user_id=current_user.id)


@router.patch("/me", response_model=GuideProfileResponse)
async def update_guide_profile_me(
    user_service: UserServiceDep,
    profile_in: GuideProfileUpdate,
    current_user: GuideOrAdminUser,
) -> GuideProfileResponse:
    return await user_service.update_guide_profile(
        user_id=current_user.id,
        profile_in=profile_in,
    )


@router.get("/me/bookings", response_model=GuideBookingsPublic)
async def read_guide_bookings(
    booking_service: BookingServiceDep,
    pagination: PaginationDep,
    current_user: GuideOrAdminUser,
    status: BookingStatus | None = None,
    tour_id: str | None = None,
    date_from: datetime.datetime | None = None,
    date_to: datetime.datetime | None = None,
) -> GuideBookingsPublic:
    return await booking_service.get_guide_bookings(
        guide_id=current_user.id,
        page=pagination.page,
        limit=pagination.limit,
        status=status,
        tour_id=tour_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/me/bookings/{booking_id}/confirm", response_model=BookingResponse)
async def confirm_guide_booking(
    booking_service: BookingServiceDep,
    current_user: GuideOrAdminUser,
    booking_id: str,
) -> BookingResponse:
    return await booking_service.confirm_booking_by_guide(
        booking_id=booking_id,
        guide_id=current_user.id,
    )


@router.post("/me/bookings/{booking_id}/cancel", response_model=BookingCancelResponse)
async def cancel_guide_booking(
    booking_service: BookingServiceDep,
    current_user: GuideOrAdminUser,
    booking_id: str,
) -> BookingCancelResponse:
    return await booking_service.cancel_booking_by_guide(
        booking_id=booking_id,
        guide_id=current_user.id,
    )


@router.get("/me/stats", response_model=GuideStatsResponse)
async def read_guide_stats(
    tour_service: TourServiceDep,
    current_user: GuideOrAdminUser,
) -> GuideStatsResponse:
    return await tour_service.get_guide_stats(guide_id=current_user.id)


@router.get("/me/reviews", response_model=ReviewsPublic)
async def read_guide_reviews(
    review_service: ReviewServiceDep,
    pagination: PaginationDep,
    current_user: GuideOrAdminUser,
    rating: int | None = None,
) -> ReviewsPublic:
    return await review_service.get_guide_reviews(
        guide_id=str(current_user.id),
        page=pagination.page,
        limit=pagination.limit,
        rating=rating,
    )


@router.get("/{user_id}", response_model=GuidePublicProfileResponse)
async def read_guide_profile_by_id(
    user_service: UserServiceDep,
    tour_service: TourServiceDep,
    user: UserOr404,
) -> GuidePublicProfileResponse:
    # Путь называется user_id, потому что Depends(get_user_or_404) ожидает
    # параметр с таким именем. Раньше было guide_id + user: UserOr404 —
    # FastAPI не мог сопоставить guide_id → user_id и отдавал 422 Field required.
    return await user_service.get_guide_public_profile(guide=user, tour_service=tour_service)
