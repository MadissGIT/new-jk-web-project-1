from collections.abc import Sequence
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select

from src.app.core.security import get_password_hash
from src.app.core.settings import get_project_settings
from src.app.db.models.guide_application import (
    GuideApplication,
    GuideApplicationCreate,
    GuideApplicationStatus,
)
from src.app.db.models.guide_profile import GuideProfile, GuideProfileUpdate
from src.app.db.models.user import Role, User, UserCreate, UserStatus, UserUpdate
from src.app.db.models.user_preference import UserPreferences, UserPreferencesUpdate
from src.app.repositories.base import BaseRepository

project_settings = get_project_settings()


class UserRepository(BaseRepository[User]):
    model = User

    async def get_user(self, **filters: Any) -> User | None:
        return await self.get_one_by(**filters)

    async def get_users(
        self,
        skip: int = 0,
        limit: int = project_settings.DEFAULT_QUERY_LIMIT,
        role: Role | None = None,
        status: UserStatus | None = None,
    ) -> tuple[Sequence[User], int]:
        filters: dict[str, Any] = {}
        if role is not None:
            filters["role"] = role
        if status is not None:
            filters["status"] = status
        return await self.list_and_count(skip=skip, limit=limit, **filters)

    async def create_user(self, user_create: UserCreate) -> User:
        if await self.get_user(email=user_create.email):
            raise HTTPException(
                status_code=409,
                detail="Пользователь с таким email уже существует",
            )

        user = User.model_validate(
            user_create,
            update={
                "hashed_password": get_password_hash(user_create.password),
            },
        )
        return await self.add(user)

    async def update_user(
        self,
        db_user: User,
        user_in: UserUpdate,
    ) -> User:
        user_data = user_in.model_dump(exclude_unset=True)

        for key, value in user_data.items():
            setattr(db_user, key, value)

        return await self.add(db_user)

    async def get_preferences(self, user_id: Any) -> UserPreferences | None:
        return await self.session.get(UserPreferences, user_id)

    async def upsert_preferences(
        self,
        *,
        user_id: Any,
        preferences_in: UserPreferencesUpdate,
    ) -> UserPreferences:
        preferences = await self.get_preferences(user_id=user_id)
        if preferences is None:
            preferences = UserPreferences(
                user_id=user_id,
                interests=preferences_in.interests,
                pace=preferences_in.pace,
                budget_level=preferences_in.budget_level,
                wheelchair_required=preferences_in.accessibility.wheelchair_required,
                avoid_stairs=preferences_in.accessibility.avoid_stairs,
                need_rest_points=preferences_in.accessibility.need_rest_points,
                with_children=preferences_in.accessibility.with_children,
                audio_preferred=preferences_in.accessibility.audio_preferred,
            )
            self.session.add(preferences)
        else:
            preferences.interests = preferences_in.interests
            preferences.pace = preferences_in.pace
            preferences.budget_level = preferences_in.budget_level
            preferences.wheelchair_required = preferences_in.accessibility.wheelchair_required
            preferences.avoid_stairs = preferences_in.accessibility.avoid_stairs
            preferences.need_rest_points = preferences_in.accessibility.need_rest_points
            preferences.with_children = preferences_in.accessibility.with_children
            preferences.audio_preferred = preferences_in.accessibility.audio_preferred
        await self.session.commit()
        await self.session.refresh(preferences)
        return preferences

    async def get_guide_profile(self, user_id: Any) -> GuideProfile | None:
        return await self.session.get(GuideProfile, user_id)

    async def upsert_guide_profile(
        self,
        *,
        user_id: Any,
        profile_in: GuideProfileUpdate,
    ) -> GuideProfile:
        profile = await self.get_guide_profile(user_id=user_id)
        if profile is None:
            profile = GuideProfile(
                user_id=user_id,
                bio=profile_in.bio,
                specialization=profile_in.specialization,
                languages=profile_in.languages,
                experience=profile_in.experience,
                avatar=profile_in.avatar,
            )
            self.session.add(profile)
        else:
            profile.bio = profile_in.bio
            profile.specialization = profile_in.specialization
            profile.languages = profile_in.languages
            profile.experience = profile_in.experience
            profile.avatar = profile_in.avatar
        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def update_guide_application_payload(
        self,
        *,
        application: GuideApplication,
        payload: dict,
    ) -> GuideApplication:
        application.payload = payload
        self.session.add(application)
        await self.session.commit()
        await self.session.refresh(application)
        return application

    async def get_pending_guide_application(self, user_id: Any) -> GuideApplication | None:
        statement = (
            select(GuideApplication)
            .where(GuideApplication.user_id == user_id)
            .where(GuideApplication.status == GuideApplicationStatus.PENDING)
            .order_by(GuideApplication.created_at.desc())
            .limit(1)
        )
        return (await self.session.execute(statement)).scalars().first()

    async def get_latest_guide_application(self, user_id: Any) -> GuideApplication | None:
        statement = (
            select(GuideApplication)
            .where(GuideApplication.user_id == user_id)
            .order_by(GuideApplication.created_at.desc())
            .limit(1)
        )
        return (await self.session.execute(statement)).scalars().first()

    async def create_guide_application(
        self,
        user_id: Any,
        application_in: GuideApplicationCreate,
    ) -> GuideApplication:
        application = GuideApplication(
            user_id=user_id,
            payload=application_in.payload,
            status=GuideApplicationStatus.PENDING,
        )
        return await self.add(application)

    async def get_guide_application(self, application_id: str) -> GuideApplication | None:
        return await self.session.get(GuideApplication, application_id)

    async def list_guide_applications(
        self,
        skip: int = 0,
        limit: int = project_settings.DEFAULT_QUERY_LIMIT,
        status: GuideApplicationStatus | None = None,
    ) -> tuple[Sequence[GuideApplication], int]:
        statement = select(GuideApplication)
        total_statement = select(func.count()).select_from(GuideApplication)
        if status is not None:
            statement = statement.where(GuideApplication.status == status)
            total_statement = total_statement.where(GuideApplication.status == status)
        statement = statement.order_by(GuideApplication.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total
