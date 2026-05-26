import datetime
import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlmodel import Field, SQLModel

from src.app.const import Variants
from src.app.db.schemas import DetailResponse, ListResponse


def build_review_id() -> str:
    return f"review_{uuid.uuid4().hex[:12]}"


class ReviewEntityType(Variants):
    TOUR = "tour"
    POE = "poe"


class ReviewBase(SQLModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(max_length=4000)
    accessibility_rating: int | None = Field(default=None, ge=1, le=5)


class Review(SQLModel, table=True):
    __tablename__ = "reviews"  # type: ignore

    id: str = Field(default_factory=build_review_id, primary_key=True, max_length=32)
    entity_type: ReviewEntityType = Field(index=True)
    entity_id: str = Field(index=True, max_length=32)
    user_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
    )
    user_name: str = Field(max_length=255)
    booking_id: str | None = Field(
        default=None,
        sa_column=Column(
            String(32),
            ForeignKey("bookings.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    rating: int = Field(ge=1, le=5)
    text: str = Field(max_length=4000)
    accessibility_rating: int | None = Field(default=None, ge=1, le=5)
    hidden: bool = Field(default=False, index=True)
    suspicious: bool = Field(default=False, index=True)
    reported_count: int = Field(default=0, ge=0)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class ReviewUserPublic(SQLModel):
    id: uuid.UUID
    name: str


class ReviewPublic(SQLModel):
    id: str
    user: ReviewUserPublic
    rating: int
    text: str
    created_at: datetime.datetime
    entity_type: ReviewEntityType | None = None
    entity_id: str | None = None
    entity_title: str | None = None


class ReviewCreatedPublic(SQLModel):
    id: str
    rating: int
    text: str
    accessibility_rating: int | None = None
    created_at: datetime.datetime | None = None


class ReviewModerationDecision(SQLModel):
    suspicious: bool | None = None
    reported_count: int | None = Field(default=None, ge=0)


class TourReviewCreate(ReviewBase):
    booking_id: str


class PoeReviewCreate(ReviewBase):
    pass


ReviewsPublic = ListResponse[ReviewPublic]
ReviewResponse = DetailResponse[ReviewCreatedPublic]
