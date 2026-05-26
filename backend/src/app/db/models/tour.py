import datetime
import uuid

from sqlalchemy import JSON, Column, ForeignKey, Text
from sqlmodel import Field, SQLModel

from src.app.const import Variants
from src.app.db.models.poe import Location
from src.app.db.schemas import DetailResponse, ListResponse


def build_tour_id() -> str:
    return f"tour_{uuid.uuid4().hex[:12]}"


def build_slot_id() -> str:
    return f"slot_{uuid.uuid4().hex[:12]}"


class TourFormat(Variants):
    OFFLINE_GUIDED = "offline_guided"
    SELF_GUIDED = "self_guided"
    AUDIO_GUIDE = "audio_guide"
    PRIVATE_TOUR = "private_tour"
    GROUP_TOUR = "group_tour"


class SlotStatus(Variants):
    AVAILABLE = "available"
    SOLD_OUT = "sold_out"
    CANCELLED = "cancelled"


class TourStatus(Variants):
    DRAFT = "draft"
    MODERATION = "moderation"
    PUBLISHED = "published"
    HIDDEN = "hidden"
    REJECTED = "rejected"


class Price(SQLModel):
    amount: int
    currency: str = "RUB"


class GuidePublic(SQLModel):
    id: str
    name: str
    rating: float = 0.0
    reviews_count: int = 0


class GuideDetail(GuidePublic):
    avatar_url: str | None = None
    bio: str | None = None


class TourAccessibility(SQLModel):
    wheelchair_accessible: bool = False
    avoid_stairs_possible: bool = False


class RoutePreview(SQLModel):
    distance_meters: int = 0
    points_count: int = 0


class TourBase(SQLModel):
    title: str = Field(max_length=255)
    description: str
    city_id: str = Field(index=True, max_length=64)
    guide_id: str = Field(max_length=64)
    guide_name: str = Field(max_length=255)
    guide_avatar_url: str | None = Field(default=None, max_length=512)
    guide_rating: float = Field(default=0.0, ge=0, le=5)
    guide_reviews_count: int = Field(default=0, ge=0)
    guide_bio: str | None = None
    format: TourFormat = Field(index=True)
    language: str = Field(default="ru", index=True, max_length=8)
    duration_minutes: int = Field(ge=1)
    group_size_max: int = Field(default=10, ge=1)
    price_amount: int = Field(ge=0)
    price_currency: str = Field(default="RUB", max_length=8)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    meeting_lat: float
    meeting_lng: float
    meeting_address: str | None = Field(default=None, max_length=512)
    wheelchair_accessible: bool = Field(default=False, index=True)
    avoid_stairs_possible: bool = False
    rating: float = Field(default=0.0, ge=0, le=5)
    reviews_count: int = Field(default=0, ge=0)
    cover_image_url: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    images: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    cancellation_policy: str = Field(default="free_24h", max_length=64)
    route_distance_meters: int = Field(default=0, ge=0)
    route_points_count: int = Field(default=0, ge=0)


class Tour(TourBase, table=True):
    __tablename__ = "tours"  # type: ignore

    id: str = Field(default_factory=build_tour_id, primary_key=True, max_length=32)
    status: TourStatus = Field(default=TourStatus.DRAFT, index=True)
    moderation_reason: str | None = Field(default=None, max_length=1024)
    moderated_at: datetime.datetime | None = None
    moderated_by: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class TourSlot(SQLModel, table=True):
    __tablename__ = "tour_slots"  # type: ignore

    id: str = Field(default_factory=build_slot_id, primary_key=True, max_length=32)
    tour_id: str = Field(foreign_key="tours.id", index=True, max_length=32)
    starts_at: datetime.datetime = Field(index=True)
    ends_at: datetime.datetime
    available_capacity: int = Field(ge=0)
    price_amount: int = Field(ge=0)
    price_currency: str = Field(default="RUB", max_length=8)
    status: SlotStatus = Field(default=SlotStatus.AVAILABLE, index=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class TourCreate(TourBase):
    guide_id: str | None = None
    guide_name: str | None = None
    status: TourStatus = TourStatus.DRAFT
    guide_avatar_url: str | None = None
    guide_rating: float = 0.0
    guide_reviews_count: int = 0
    guide_bio: str | None = None


class TourUpdate(SQLModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    format: TourFormat | None = None
    language: str | None = Field(default=None, max_length=8)
    duration_minutes: int | None = Field(default=None, ge=1)
    group_size_max: int | None = Field(default=None, ge=1)
    price_amount: int | None = Field(default=None, ge=0)
    price_currency: str | None = Field(default=None, max_length=8)
    tags: list[str] | None = None
    meeting_lat: float | None = None
    meeting_lng: float | None = None
    meeting_address: str | None = Field(default=None, max_length=512)
    wheelchair_accessible: bool | None = None
    avoid_stairs_possible: bool | None = None
    cover_image_url: str | None = None
    images: list[str] | None = None
    cancellation_policy: str | None = Field(default=None, max_length=64)


class TourStatusUpdate(SQLModel):
    status: TourStatus


class TourModerationDecision(SQLModel):
    reason: str | None = Field(default=None, max_length=1024)


class TourSlotCreate(SQLModel):
    starts_at: datetime.datetime
    ends_at: datetime.datetime
    available_capacity: int = Field(ge=0)
    price: Price
    status: SlotStatus = SlotStatus.AVAILABLE


class TourSlotUpdate(SQLModel):
    starts_at: datetime.datetime | None = None
    ends_at: datetime.datetime | None = None
    available_capacity: int | None = Field(default=None, ge=0)
    price: Price | None = None
    status: SlotStatus | None = None


class TourPublic(SQLModel):
    id: str
    title: str
    short_description: str
    city_id: str
    format: TourFormat
    language: str
    duration_minutes: int
    group_size_max: int
    status: TourStatus
    price: Price
    guide: GuidePublic
    rating: float
    reviews_count: int
    cover_image_url: str | None = None
    tags: list[str]
    meeting_point: Location
    accessibility: TourAccessibility


class TourDetail(SQLModel):
    id: str
    title: str
    description: str
    city_id: str
    rating: float
    reviews_count: int
    guide: GuideDetail
    format: TourFormat
    language: str
    duration_minutes: int
    status: TourStatus
    group_size_max: int
    price: Price
    tags: list[str]
    meeting_point: Location
    route_preview: RoutePreview
    accessibility: TourAccessibility
    moderation_reason: str | None = None
    images: list[str]
    cancellation_policy: str


class TourSlotPublic(SQLModel):
    id: str
    starts_at: datetime.datetime
    ends_at: datetime.datetime
    available_capacity: int
    price: Price
    status: SlotStatus


ToursPublic = ListResponse[TourPublic]
TourResponse = DetailResponse[TourDetail]
TourSlotResponse = DetailResponse[TourSlotPublic]
TourSlotsResponse = DetailResponse[list[TourSlotPublic]]
