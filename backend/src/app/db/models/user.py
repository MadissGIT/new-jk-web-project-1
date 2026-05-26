import datetime
import uuid

from pydantic import EmailStr, field_serializer, field_validator
from sqlalchemy import Column, ForeignKey, Text
from sqlmodel import Field, SQLModel

from src.app.const import Variants
from src.app.db.schemas import ListResponse, Message


class Role(Variants):
    USER = "user"
    EMPLOYEE = "employee"
    ADMIN = "admin"
    TOURIST = "user"
    GUIDE = "employee"


class UserStatus(Variants):
    ACTIVE = "active"
    BLOCKED = "blocked"


class UserBase(SQLModel):
    name: str = Field(max_length=255, nullable=False)
    surname: str = Field(max_length=255, nullable=False)
    patronymic: str | None = Field(max_length=255, nullable=True)
    phone: str | None = Field(default=None, max_length=64, nullable=True)
    avatar_url: str | None = Field(default=None, sa_column=Column(Text(), nullable=True))
    role: Role = Field(default=Role.TOURIST)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    email: EmailStr = Field(max_length=255, unique=True, nullable=False, index=True)
    date_of_birth: datetime.date

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: object) -> object:
        if value == "user":
            return Role.TOURIST
        if value == "employee":
            return Role.GUIDE
        return value


class User(UserBase, table=True):
    __tablename__ = "users" # type: ignore

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    blocked_at: datetime.datetime | None = None
    blocked_by: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    block_reason: str | None = Field(default=None, max_length=1024)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class UserCreate(UserBase):
    password: str

    @field_serializer("email")
    def serialize_email(self, email: EmailStr) -> str:
        return email.lower()


class UserUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)
    surname: str | None = Field(default=None, max_length=255)
    patronymic: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    avatar_url: str | None = None


class UserBlockRequest(SQLModel):
    reason: str | None = Field(default=None, max_length=1024)


class UserPublic(UserBase):
    id: uuid.UUID
    blocked_at: datetime.datetime | None = None
    blocked_by: uuid.UUID | None = None
    block_reason: str | None = None
    created_at: datetime.datetime


UsersPublic = ListResponse[UserPublic]
UserModerationResponse = Message
