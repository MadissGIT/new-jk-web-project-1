import datetime
import uuid

from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.app.const import Variants
from src.app.db.models.tour import Price
from src.app.db.schemas import DetailResponse, ListResponse


def build_booking_id() -> str:
    return f"booking_{uuid.uuid4().hex[:12]}"


def build_payment_id() -> str:
    return f"pay_{uuid.uuid4().hex[:12]}"


class BookingStatus(Variants):
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    REFUNDED = "refunded"


class RefundStatus(Variants):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    REFUNDED = "refunded"


class PaymentPublic(SQLModel):
    payment_id: str
    payment_url: str


class Booking(SQLModel, table=True):
    __tablename__ = "bookings"  # type: ignore
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_bookings_user_idempotency_key"),
    )

    id: str = Field(default_factory=build_booking_id, primary_key=True, max_length=32)
    tour_id: str = Field(
        sa_column=Column(
            String(32),
            ForeignKey("tours.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
    )
    slot_id: str = Field(
        sa_column=Column(
            String(32),
            ForeignKey("tour_slots.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
    )
    participants_count: int = Field(ge=1)
    status: BookingStatus = Field(default=BookingStatus.PENDING_PAYMENT, index=True)
    price_total_amount: int = Field(ge=0)
    price_total_currency: str = Field(default="RUB", max_length=8)
    payment_id: str = Field(default_factory=build_payment_id, index=True, max_length=32)
    payment_url: str = Field(max_length=512)
    contact_phone: str | None = Field(default=None, max_length=32)
    comment: str | None = None
    idempotency_key: str | None = Field(default=None, max_length=128)
    cancel_reason: str | None = None
    refund_status: RefundStatus | None = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class BookingCreate(SQLModel):
    tour_id: str
    slot_id: str
    participants_count: int = Field(ge=1)
    contact_phone: str | None = Field(default=None, max_length=32)
    comment: str | None = None
    idempotency_key: str | None = Field(default=None, max_length=128)


class BookingCancelRequest(SQLModel):
    reason: str | None = None


class BookingTourShort(SQLModel):
    id: str
    title: str


class BookingSlotShort(SQLModel):
    id: str
    starts_at: datetime.datetime


class BookingSlotDetail(BookingSlotShort):
    ends_at: datetime.datetime | None = None


class BookingCreatedPublic(SQLModel):
    id: str
    tour_id: str
    slot_id: str
    user_id: uuid.UUID
    participants_count: int
    status: BookingStatus
    price_total: Price
    payment: PaymentPublic
    created_at: datetime.datetime


class BookingPublic(SQLModel):
    id: str
    tour: BookingTourShort
    slot: BookingSlotShort
    participants_count: int
    status: BookingStatus
    price_total: Price
    contact_phone: str | None = None
    comment: str | None = None


class GuideBookingPublic(BookingPublic):
    customer_name: str


class BookingDetail(BookingPublic):
    slot: BookingSlotDetail
    meeting_point: dict[str, str | None]


class BookingCancelledPublic(SQLModel):
    id: str
    status: BookingStatus
    refund_status: RefundStatus


class MockPaymentPublic(SQLModel):
    booking_id: str
    payment_id: str
    status: BookingStatus


BookingCreateResponse = DetailResponse[BookingCreatedPublic]
BookingsPublic = ListResponse[BookingPublic]
GuideBookingsPublic = ListResponse[GuideBookingPublic]
BookingResponse = DetailResponse[BookingDetail]
BookingCancelResponse = DetailResponse[BookingCancelledPublic]
MockPaymentResponse = DetailResponse[MockPaymentPublic]
