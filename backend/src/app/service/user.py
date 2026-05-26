import datetime
import uuid

from fastapi import HTTPException

from src.app.core.security import verify_password
from src.app.core.settings import get_project_settings
from src.app.db.models.guide_application import (
    GuideApplication,
    GuideApplicationCreate,
    GuideApplicationDecision,
    GuideApplicationPublic,
    GuideApplicationResponse,
    GuideApplicationsPublic,
    GuideApplicationStatus,
)
from src.app.db.models.guide_profile import (
    GuideProfile,
    GuideProfilePublic,
    GuideProfileResponse,
    GuideProfileUpdate,
    GuidePublicProfileResponse,
    GuidePublicView,
)
from src.app.db.models.user import (
    Role,
    User,
    UserCreate,
    UserPublic,
    UsersPublic,
    UserStatus,
    UserUpdate,
)
from src.app.db.models.user_preference import (
    PreferenceAccessibility,
    UserPreferences,
    UserPreferencesPublic,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from src.app.db.schemas import DetailResponse, Message, PaginationMeta
from src.app.repositories.user import UserRepository
from src.app.service.base import BaseService

project_settings = get_project_settings()

class UserService(BaseService[UserRepository]):
    async def authenticate(self, email: str, password: str) -> User | None:
        db_user = await self.repository.get_user(email=email)
        if not db_user:
            return None
        if not verify_password(password, db_user.hashed_password):
            return None
        return db_user

    async def get_user(self, **filters: object) -> UserPublic | None:
        if not (user := await self.repository.get_user(**filters)):
            return None
        return UserPublic.model_validate(user)

    async def get_users(
        self,
        page: int = 1,
        limit: int = project_settings.DEFAULT_QUERY_LIMIT,
        role: Role | None = None,
        status: UserStatus | None = None,
    ) -> UsersPublic:
        skip = (page - 1) * limit
        users, total = await self.repository.get_users(skip, limit, role, status)
        return UsersPublic(
            data=[UserPublic.model_validate(user) for user in users],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def create_user(self, user_in: UserCreate) -> UserPublic:
        return UserPublic.model_validate(
            await self.repository.create_user(user_in),
        )

    async def update_user(
        self,
        db_user: User,
        user_in: UserUpdate,
    ) -> UserPublic:
        return UserPublic.model_validate(
            await self.repository.update_user(
                db_user=db_user,
                user_in=user_in,
            ),
        )

    async def delete_user(self, user_in: User) -> bool:
        return await self.repository.delete(user_in)

    async def block_user(
        self,
        user_id: uuid.UUID,
        admin_id: uuid.UUID,
        reason: str | None,
    ) -> Message:
        user = await self.repository.get_user(id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role == Role.ADMIN:
            raise HTTPException(status_code=409, detail="Admin user cannot be blocked")
        user.status = UserStatus.BLOCKED
        user.blocked_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        user.blocked_by = admin_id
        user.block_reason = reason
        await self.repository.add(user)
        return Message(message="User blocked")

    async def unblock_user(self, user_id: uuid.UUID) -> Message:
        user = await self.repository.get_user(id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.status = UserStatus.ACTIVE
        user.blocked_at = None
        user.blocked_by = None
        user.block_reason = None
        await self.repository.add(user)
        return Message(message="User unblocked")

    async def apply_for_guide(
        self,
        user_id: uuid.UUID,
        application_in: GuideApplicationCreate,
    ) -> GuideApplicationResponse:
        existing = await self.repository.get_pending_guide_application(user_id=user_id)
        if existing:
            raise HTTPException(status_code=409, detail="Pending application already exists")
        application = await self.repository.create_guide_application(user_id, application_in)
        return DetailResponse(data=self._guide_application_to_public(application))

    async def get_latest_guide_application_for_user(
        self,
        user_id: uuid.UUID,
    ) -> GuideApplicationResponse:
        application = await self.repository.get_latest_guide_application(user_id=user_id)
        if not application:
            raise HTTPException(status_code=404, detail="Guide application not found")
        return DetailResponse(data=self._guide_application_to_public(application))

    async def get_guide_applications(
        self,
        page: int,
        limit: int,
        status: GuideApplicationStatus | None = None,
    ) -> GuideApplicationsPublic:
        items, total = await self.repository.list_guide_applications(
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
        )
        return GuideApplicationsPublic(
            data=[self._guide_application_to_public(item) for item in items],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def approve_guide_application(
        self,
        application_id: str,
        admin_id: uuid.UUID,
    ) -> GuideApplicationResponse:
        application = await self._get_pending_application(application_id)
        user = await self.repository.get_user(id=application.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.role = Role.GUIDE
        await self.repository.add(user)
        application.status = GuideApplicationStatus.APPROVED
        application.reviewed_by = admin_id
        application.reviewed_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        application.rejection_reason = None
        application = await self.repository.add(application)
        return DetailResponse(data=self._guide_application_to_public(application))

    async def reject_guide_application(
        self,
        application_id: str,
        admin_id: uuid.UUID,
        decision_in: GuideApplicationDecision,
    ) -> GuideApplicationResponse:
        application = await self._get_pending_application(application_id)
        application.status = GuideApplicationStatus.REJECTED
        application.reviewed_by = admin_id
        application.reviewed_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        application.rejection_reason = decision_in.reason
        application = await self.repository.add(application)
        return DetailResponse(data=self._guide_application_to_public(application))

    async def get_preferences(self, user_id: object) -> UserPreferencesResponse:
        preferences = await self.repository.get_preferences(user_id=user_id)
        if preferences is None:
            preferences = UserPreferences(user_id=user_id)  # type: ignore[arg-type]
        return DetailResponse(data=self._preferences_to_public(preferences))

    async def update_preferences(
        self,
        *,
        user_id: object,
        preferences_in: UserPreferencesUpdate,
    ) -> UserPreferencesResponse:
        preferences = await self.repository.upsert_preferences(
            user_id=user_id,
            preferences_in=preferences_in,
        )
        return DetailResponse(data=self._preferences_to_public(preferences))

    async def get_guide_profile(self, user_id: object) -> GuideProfileResponse:
        profile = await self.repository.get_guide_profile(user_id=user_id)
        if profile is None:
            profile = GuideProfile(user_id=user_id)  # type: ignore[arg-type]
        return DetailResponse(data=self._guide_profile_to_public(profile))

    async def get_guide_public_profile(
        self,
        *,
        guide: User,
        tour_service: object,
    ) -> GuidePublicProfileResponse:
        """Публичная карточка гида для туристов: профиль + статистика + туры."""
        from src.app.service.tour import TourService

        if not isinstance(tour_service, TourService):
            raise TypeError("tour_service must be TourService")

        profile = (await self.get_guide_profile(user_id=guide.id)).data
        stats = (await tour_service.get_guide_stats(guide_id=guide.id)).data
        tours = await tour_service.get_guide_published_tours_brief(guide_id=guide.id, limit=20)

        application = await self.repository.get_latest_guide_application(user_id=guide.id)
        contacts: str | None = None
        display_name: str | None = None
        payload_bio = ""
        payload_specialization = ""
        payload_languages: list[str] = []
        payload_experience = 0
        if application and application.status == GuideApplicationStatus.APPROVED:
            payload = application.payload or {}
            contacts = payload.get("contacts")
            display_name = payload.get("displayName")
            payload_bio = str(payload.get("bio") or "")
            specs = payload.get("specializations")
            if isinstance(specs, list):
                payload_specialization = ", ".join(str(item) for item in specs if item)
            payload_languages = payload.get("languages") if isinstance(payload.get("languages"), list) else []
            payload_experience = int(payload.get("experienceYears") or 0)

        name = (display_name or f"{guide.name} {guide.surname}").strip()
        avatar = profile.avatar or guide.avatar_url
        bio = profile.bio or payload_bio
        specialization = profile.specialization or payload_specialization
        languages = profile.languages if profile.languages else payload_languages
        experience = profile.experience if profile.experience > 0 else payload_experience

        rating_map = await tour_service.repository.get_guide_rating_stats_map(
            guide_ids=[str(guide.id)],
        )
        avg_rating, reviews_count = rating_map.get(str(guide.id), (stats.avg_rating, 0))

        return DetailResponse(
            data=GuidePublicView(
                user_id=guide.id,
                name=name,
                email=str(guide.email),
                phone=guide.phone,
                contacts=contacts,
                bio=bio,
                specialization=specialization,
                languages=languages,
                experience=experience,
                avatar=avatar,
                rating=float(avg_rating),
                reviews_count=int(reviews_count),
                tours_count=stats.tours_count,
                tours=tours,
            ),
        )

    async def update_guide_profile(
        self,
        *,
        user_id: object,
        profile_in: GuideProfileUpdate,
    ) -> GuideProfileResponse:
        avatar = profile_in.avatar
        if avatar and len(avatar) > 512:
            avatar = None

        profile = await self.repository.upsert_guide_profile(
            user_id=user_id,
            profile_in=GuideProfileUpdate(
                bio=profile_in.bio,
                specialization=profile_in.specialization,
                languages=profile_in.languages,
                experience=profile_in.experience,
                avatar=avatar,
            ),
        )
        # Сериализуем до второго commit: иначе ORM-объект протухает (MissingGreenlet).
        profile_public = self._guide_profile_to_public(profile)

        application = await self.repository.get_latest_guide_application(user_id=user_id)
        if application and application.status == GuideApplicationStatus.APPROVED:
            payload = dict(application.payload or {})
            payload["bio"] = profile_in.bio
            payload["specializations"] = [
                item.strip()
                for item in profile_in.specialization.split(",")
                if item.strip()
            ]
            payload["languages"] = list(profile_in.languages)
            payload["experienceYears"] = profile_in.experience
            if profile_in.display_name is not None:
                payload["displayName"] = profile_in.display_name
            if profile_in.contacts is not None:
                payload["contacts"] = profile_in.contacts
            await self.repository.update_guide_application_payload(
                application=application,
                payload=payload,
            )

        return DetailResponse(data=profile_public)

    def _preferences_to_public(self, preferences: UserPreferences) -> UserPreferencesPublic:
        return UserPreferencesPublic(
            interests=preferences.interests,
            pace=preferences.pace,
            budget_level=preferences.budget_level,
            accessibility=PreferenceAccessibility(
                wheelchair_required=preferences.wheelchair_required,
                avoid_stairs=preferences.avoid_stairs,
                need_rest_points=preferences.need_rest_points,
                with_children=preferences.with_children,
                audio_preferred=preferences.audio_preferred,
            ),
        )

    def _guide_profile_to_public(self, profile: GuideProfile) -> GuideProfilePublic:
        return GuideProfilePublic(
            user_id=profile.user_id,
            bio=profile.bio,
            specialization=profile.specialization,
            languages=profile.languages,
            experience=profile.experience,
            avatar=profile.avatar,
        )

    async def _get_pending_application(self, application_id: str) -> GuideApplication:
        application = await self.repository.get_guide_application(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Guide application not found")
        if application.status != GuideApplicationStatus.PENDING:
            raise HTTPException(status_code=409, detail="Guide application already reviewed")
        return application

    def _guide_application_to_public(self, application: GuideApplication) -> GuideApplicationPublic:
        return GuideApplicationPublic(
            id=application.id,
            user_id=application.user_id,
            payload=application.payload,
            status=application.status,
            reviewed_by=application.reviewed_by,
            reviewed_at=application.reviewed_at,
            rejection_reason=application.rejection_reason,
            created_at=application.created_at,
        )
