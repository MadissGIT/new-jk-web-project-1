import uuid

from sqlalchemy import JSON, Column, ForeignKey
from sqlmodel import Field, SQLModel

from src.app.db.schemas import DetailResponse


class GuideProfile(SQLModel, table=True):
    __tablename__ = "guide_profiles"  # type: ignore

    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    bio: str = Field(default="", max_length=4000)
    specialization: str = Field(default="", max_length=255)
    languages: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    experience: int = Field(default=0, ge=0)
    avatar: str | None = Field(default=None, max_length=512)


class GuideProfilePublic(SQLModel):
    user_id: uuid.UUID
    bio: str
    specialization: str
    languages: list[str]
    experience: int
    avatar: str | None


class GuideProfileUpdate(SQLModel):
    bio: str = Field(default="", max_length=4000)
    specialization: str = Field(default="", max_length=255)
    languages: list[str] = Field(default_factory=list)
    experience: int = Field(default=0, ge=0)
    avatar: str | None = Field(default=None, max_length=512)
    # Синхронизируются с payload одобренной заявки (для публичной карточки).
    display_name: str | None = Field(default=None, max_length=255)
    contacts: str | None = Field(default=None, max_length=2000)


GuideProfileResponse = DetailResponse[GuideProfilePublic]


class GuideTourBriefPublic(SQLModel):
    id: str
    title: str
    cover_image_url: str | None = None
    rating: float = 0.0
    reviews_count: int = 0


class GuidePublicView(SQLModel):
    """Публичная карточка гида для туристов (экран профиля из тура)."""

    user_id: uuid.UUID
    name: str
    email: str
    phone: str | None = None
    contacts: str | None = None
    bio: str
    specialization: str
    languages: list[str]
    experience: int
    avatar: str | None = None
    rating: float = 0.0
    reviews_count: int = 0
    tours_count: int = 0
    tours: list[GuideTourBriefPublic] = Field(default_factory=list)


GuidePublicProfileResponse = DetailResponse[GuidePublicView]


class GuideTopTourPublic(SQLModel):
    id: str
    title: str
    bookings_count: int
    rating: float


class GuideStatsPublic(SQLModel):
    tours_count: int
    bookings_count: int
    avg_rating: float
    top_tours: list[GuideTopTourPublic]


GuideStatsResponse = DetailResponse[GuideStatsPublic]
