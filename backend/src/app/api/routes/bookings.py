from fastapi import APIRouter

from src.app.api.dependencies.common import BookingServiceDep, NotificationServiceDep
from src.app.api.dependencies.pagination import PaginationDep
from src.app.api.dependencies.users import CurrentUser
from src.app.core.settings import get_project_settings
from src.app.db.models.booking import (
    BookingCancelRequest,
    BookingCancelResponse,
    BookingCreate,
    BookingCreateResponse,
    BookingResponse,
    BookingsPublic,
    BookingStatus,
    MockPaymentResponse,
)

router = APIRouter()
project_settings = get_project_settings()


@router.post("", response_model=BookingCreateResponse, status_code=201)
async def create_booking(
    booking_service: BookingServiceDep,
    booking_in: BookingCreate,
    current_user: CurrentUser,
) -> BookingCreateResponse:
    return await booking_service.create_booking(
        booking_in=booking_in,
        user_id=current_user.id,
        api_prefix=project_settings.API_V1_STR,
    )


@router.get("", response_model=BookingsPublic)
@router.get("/", response_model=BookingsPublic, include_in_schema=False)
async def read_bookings(
    booking_service: BookingServiceDep,
    pagination: PaginationDep,
    current_user: CurrentUser,
    status: BookingStatus | None = None,
) -> BookingsPublic:
    return await booking_service.get_bookings(
        user_id=current_user.id,
        page=pagination.page,
        limit=pagination.limit,
        status=status,
    )


@router.get("/{booking_id}", response_model=BookingResponse)
async def read_booking(
    booking_service: BookingServiceDep,
    current_user: CurrentUser,
    booking_id: str,
) -> BookingResponse:
    return await booking_service.get_booking(
        booking_id=booking_id,
        user_id=current_user.id,
    )


@router.post("/{booking_id}/cancel", response_model=BookingCancelResponse)
async def cancel_booking(
    booking_service: BookingServiceDep,
    notification_service: NotificationServiceDep,
    current_user: CurrentUser,
    booking_id: str,
    cancel_in: BookingCancelRequest,
) -> BookingCancelResponse:
    user_id = current_user.id
    response = await booking_service.cancel_booking(
        booking_id=booking_id,
        user_id=user_id,
        cancel_in=cancel_in,
    )
    await notification_service.create_event(
        user_id=user_id,
        event_type="booking_cancelled",
        title="Бронирование отменено",
        payload=booking_id,
    )
    return response


@router.post("/{booking_id}/mock-payment/confirm", response_model=MockPaymentResponse)
async def confirm_mock_payment(
    booking_service: BookingServiceDep,
    notification_service: NotificationServiceDep,
    current_user: CurrentUser,
    booking_id: str,
) -> MockPaymentResponse:
    user_id = current_user.id
    response = await booking_service.confirm_mock_payment(
        booking_id=booking_id,
        user_id=user_id,
    )
    await notification_service.create_event(
        user_id=user_id,
        event_type="booking_confirmed",
        title="Бронирование подтверждено",
        payload=booking_id,
    )
    return response


@router.post("/{booking_id}/mock-payment/refund", response_model=MockPaymentResponse)
async def refund_mock_payment(
    booking_service: BookingServiceDep,
    current_user: CurrentUser,
    booking_id: str,
) -> MockPaymentResponse:
    return await booking_service.refund_mock_payment(
        booking_id=booking_id,
        user_id=current_user.id,
    )
