import datetime
import uuid
from collections.abc import Sequence

from fastapi import HTTPException

from src.app.db.models.guide_profile import (
    GuideStatsPublic,
    GuideStatsResponse,
    GuideTopTourPublic,
    GuideTourBriefPublic,
)
from src.app.db.models.tour import (
    GuideDetail,
    GuidePublic,
    Location,
    Price,
    RoutePreview,
    SlotStatus,
    Tour,
    TourAccessibility,
    TourCreate,
    TourDetail,
    TourFormat,
    TourModerationDecision,
    TourPublic,
    TourResponse,
    TourSlot,
    TourSlotCreate,
    TourSlotPublic,
    TourSlotResponse,
    TourSlotsResponse,
    TourSlotUpdate,
    ToursPublic,
    TourStatus,
    TourStatusUpdate,
    TourUpdate,
)
from src.app.db.schemas import DetailResponse, PaginationMeta
from src.app.repositories.tour import TourRepository
from src.app.core.datetime import normalize_app_datetime
from src.app.service.base import BaseService


def normalize_datetime(value: datetime.datetime) -> datetime.datetime:
    return normalize_app_datetime(value)


def tour_to_guide(tour: Tour) -> GuidePublic:
    return GuidePublic(
        id=tour.guide_id,
        name=tour.guide_name,
        rating=tour.guide_rating,
        reviews_count=tour.guide_reviews_count,
    )


def tour_to_guide_detail(tour: Tour) -> GuideDetail:
    return GuideDetail(
        id=tour.guide_id,
        name=tour.guide_name,
        avatar_url=tour.guide_avatar_url,
        rating=tour.guide_rating,
        reviews_count=tour.guide_reviews_count,
        bio=tour.guide_bio,
    )


def tour_to_price(tour: Tour) -> Price:
    return Price(amount=tour.price_amount, currency=tour.price_currency)


def slot_to_price(slot: TourSlot) -> Price:
    return Price(amount=slot.price_amount, currency=slot.price_currency)


def tour_to_accessibility(tour: Tour) -> TourAccessibility:
    return TourAccessibility(
        wheelchair_accessible=tour.wheelchair_accessible,
        avoid_stairs_possible=tour.avoid_stairs_possible,
    )


def tour_to_public(tour: Tour) -> TourPublic:
    cover_image_url = tour.cover_image_url
    if not cover_image_url and tour.images:
        cover_image_url = tour.images[0]

    return TourPublic(
        id=tour.id,
        title=tour.title,
        short_description=tour.description,
        city_id=tour.city_id,
        format=tour.format,
        language=tour.language,
        duration_minutes=tour.duration_minutes,
        group_size_max=tour.group_size_max,
        status=tour.status,
        price=tour_to_price(tour),
        guide=tour_to_guide(tour),
        rating=tour.rating,
        reviews_count=tour.reviews_count,
        cover_image_url=cover_image_url,
        tags=tour.tags,
        meeting_point=Location(
            lat=tour.meeting_lat,
            lng=tour.meeting_lng,
            address=tour.meeting_address,
        ),
        accessibility=tour_to_accessibility(tour),
    )


def tour_to_detail(tour: Tour) -> TourDetail:
    return TourDetail(
        id=tour.id,
        title=tour.title,
        description=tour.description,
        city_id=tour.city_id,
        rating=tour.rating,
        reviews_count=tour.reviews_count,
        guide=tour_to_guide_detail(tour),
        format=tour.format,
        language=tour.language,
        duration_minutes=tour.duration_minutes,
        status=tour.status,
        group_size_max=tour.group_size_max,
        price=tour_to_price(tour),
        tags=tour.tags,
        meeting_point=Location(
            lat=tour.meeting_lat,
            lng=tour.meeting_lng,
            address=tour.meeting_address,
        ),
        route_preview=RoutePreview(
            distance_meters=tour.route_distance_meters,
            points_count=tour.route_points_count,
        ),
        accessibility=tour_to_accessibility(tour),
        moderation_reason=tour.moderation_reason,
        images=tour.images,
        cancellation_policy=tour.cancellation_policy,
    )


def slot_to_public(slot: TourSlot) -> TourSlotPublic:
    status = slot.status
    if slot.available_capacity == 0 and status == SlotStatus.AVAILABLE:
        status = SlotStatus.SOLD_OUT
    return TourSlotPublic(
        id=slot.id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        available_capacity=slot.available_capacity,
        price=slot_to_price(slot),
        status=status,
    )


class TourService(BaseService[TourRepository]):
    async def create_tour(self, tour_in: TourCreate) -> TourResponse:
        tour = await self.repository.add(Tour.model_validate(tour_in))
        return DetailResponse(data=tour_to_detail(tour))

    async def get_tours(
        self,
        *,
        page: int,
        limit: int,
        city_id: str | None = None,
        date: datetime.date | None = None,
        format: TourFormat | None = None,
        language: str | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        duration_min: int | None = None,
        duration_max: int | None = None,
        wheelchair_accessible: bool | None = None,
    ) -> ToursPublic:
        tours, total = await self.repository.list_tours(
            skip=(page - 1) * limit,
            limit=limit,
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
        tours = await self._apply_runtime_ratings(tours)
        return ToursPublic(
            data=[tour_to_public(tour) for tour in tours],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_tour(self, tour_id: str) -> TourResponse:
        tour = await self.repository.get_by_id(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        tour = await self._apply_runtime_rating(tour)
        return DetailResponse(data=tour_to_detail(tour))

    async def get_my_tours(
        self,
        *,
        guide_id: uuid.UUID,
        page: int,
        limit: int,
    ) -> ToursPublic:
        tours, total = await self.repository.list_guide_tours(
            guide_id=str(guide_id),
            skip=(page - 1) * limit,
            limit=limit,
        )
        tours = await self._apply_runtime_ratings(tours)
        return ToursPublic(
            data=[tour_to_public(tour) for tour in tours],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def update_my_tour(
        self,
        *,
        guide_id: uuid.UUID,
        tour_id: str,
        tour_in: TourUpdate,
    ) -> TourResponse:
        tour = await self._get_guide_tour(guide_id=guide_id, tour_id=tour_id)
        for field, value in tour_in.model_dump(exclude_unset=True).items():
            setattr(tour, field, value)
        tour = await self.repository.save_tour(tour)
        tour = await self._apply_runtime_rating(tour)
        return DetailResponse(data=tour_to_detail(tour))

    async def update_my_tour_status(
        self,
        *,
        guide_id: uuid.UUID,
        tour_id: str,
        status_in: TourStatusUpdate,
    ) -> TourResponse:
        tour = await self._get_guide_tour(guide_id=guide_id, tour_id=tour_id)
        tour.status = status_in.status
        tour = await self.repository.save_tour(tour)
        tour = await self._apply_runtime_rating(tour)
        return DetailResponse(data=tour_to_detail(tour))

    async def create_slot(
        self,
        *,
        tour_id: str,
        slot_in: TourSlotCreate,
    ) -> TourSlotResponse:
        tour = await self.repository.get_by_id(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        starts_at = normalize_datetime(slot_in.starts_at)
        ends_at = normalize_datetime(slot_in.ends_at)
        if ends_at <= starts_at:
            raise HTTPException(status_code=422, detail="ends_at must be after starts_at")
        if slot_in.available_capacity > tour.group_size_max:
            raise HTTPException(status_code=422, detail="available_capacity exceeds group_size_max")
        if slot_in.status == SlotStatus.SOLD_OUT and slot_in.available_capacity > 0:
            raise HTTPException(
                status_code=422,
                detail="sold_out slot cannot have available capacity",
            )
        status = SlotStatus.SOLD_OUT if slot_in.available_capacity == 0 else slot_in.status
        slot = TourSlot(
            tour_id=tour_id,
            starts_at=starts_at,
            ends_at=ends_at,
            available_capacity=slot_in.available_capacity,
            price_amount=slot_in.price.amount,
            price_currency=slot_in.price.currency,
            status=status,
        )
        created_slot = await self.repository.add_slot(slot)
        return DetailResponse(data=slot_to_public(created_slot))

    async def get_slots(
        self,
        *,
        tour_id: str,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> TourSlotsResponse:
        tour = await self.repository.get_by_id(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        slots = await self.repository.list_slots(
            tour_id=tour_id,
            date_from=normalize_datetime(date_from) if date_from else None,
            date_to=normalize_datetime(date_to) if date_to else None,
        )
        return DetailResponse(data=[slot_to_public(slot) for slot in slots])

    async def get_guide_published_tours_brief(
        self,
        *,
        guide_id: uuid.UUID,
        limit: int = 20,
    ) -> list[GuideTourBriefPublic]:
        tours, _ = await self.repository.list_guide_tours(
            guide_id=str(guide_id),
            skip=0,
            limit=limit,
        )
        published = [tour for tour in tours if tour.status == TourStatus.PUBLISHED]
        published = await self._apply_runtime_ratings(published)
        return [
            GuideTourBriefPublic(
                id=tour.id,
                title=tour.title,
                cover_image_url=tour.cover_image_url,
                rating=tour.rating,
                reviews_count=tour.reviews_count,
            )
            for tour in published
        ]

    async def get_guide_stats(self, guide_id: uuid.UUID) -> GuideStatsResponse:
        _, tours_count = await self.repository.list_guide_tours(
            guide_id=str(guide_id),
            skip=0,
            limit=1,
        )
        bookings_count = await self.repository.get_guide_bookings_count(guide_id=str(guide_id))
        avg_rating = await self.repository.get_guide_avg_rating(guide_id=str(guide_id))
        top_rows = await self.repository.get_guide_top_tours(guide_id=str(guide_id), limit=5)
        return DetailResponse(
            data=GuideStatsPublic(
                tours_count=tours_count,
                bookings_count=bookings_count,
                avg_rating=avg_rating,
                top_tours=[
                    GuideTopTourPublic(
                        id=tour_id,
                        title=title,
                        bookings_count=bookings_count_item,
                        rating=rating,
                    )
                    for tour_id, title, bookings_count_item, rating in top_rows
                ],
            ),
        )

    async def get_admin_tours(
        self,
        page: int,
        limit: int,
        status: TourStatus | None = None,
    ) -> ToursPublic:
        tours, total = await self.repository.list_admin_tours(
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
        )
        tours = await self._apply_runtime_ratings(tours)
        return ToursPublic(
            data=[tour_to_public(tour) for tour in tours],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def approve_tour(
        self,
        tour_id: str,
        admin_id: uuid.UUID,
        decision_in: TourModerationDecision,
    ) -> TourResponse:
        return await self._moderate_tour(
            tour_id=tour_id,
            admin_id=admin_id,
            status=TourStatus.PUBLISHED,
            reason=decision_in.reason,
        )

    async def hide_tour(
        self,
        tour_id: str,
        admin_id: uuid.UUID,
        decision_in: TourModerationDecision,
    ) -> TourResponse:
        return await self._moderate_tour(
            tour_id=tour_id,
            admin_id=admin_id,
            status=TourStatus.HIDDEN,
            reason=decision_in.reason,
        )

    async def reject_tour(
        self,
        tour_id: str,
        admin_id: uuid.UUID,
        decision_in: TourModerationDecision,
    ) -> TourResponse:
        return await self._moderate_tour(
            tour_id=tour_id,
            admin_id=admin_id,
            status=TourStatus.REJECTED,
            reason=decision_in.reason,
        )

    async def update_my_slot(
        self,
        *,
        guide_id: uuid.UUID,
        tour_id: str,
        slot_id: str,
        slot_in: TourSlotUpdate,
    ) -> TourSlotResponse:
        tour = await self._get_guide_tour(guide_id=guide_id, tour_id=tour_id)
        slot = await self.repository.get_slot(slot_id)
        if not slot or slot.tour_id != tour.id:
            raise HTTPException(status_code=404, detail="Slot not found")

        starts_at = normalize_datetime(slot_in.starts_at) if slot_in.starts_at else slot.starts_at
        ends_at = normalize_datetime(slot_in.ends_at) if slot_in.ends_at else slot.ends_at
        if ends_at <= starts_at:
            raise HTTPException(status_code=422, detail="ends_at must be after starts_at")

        available_capacity = (
            slot.available_capacity
            if slot_in.available_capacity is None
            else slot_in.available_capacity
        )
        if available_capacity > tour.group_size_max:
            raise HTTPException(status_code=422, detail="available_capacity exceeds group_size_max")

        next_status = slot.status if slot_in.status is None else slot_in.status
        if next_status == SlotStatus.SOLD_OUT and available_capacity > 0:
            raise HTTPException(
                status_code=422,
                detail="sold_out slot cannot have available capacity",
            )
        if available_capacity == 0:
            next_status = SlotStatus.SOLD_OUT

        slot.starts_at = starts_at
        slot.ends_at = ends_at
        slot.available_capacity = available_capacity
        slot.status = next_status
        if slot_in.price is not None:
            slot.price_amount = slot_in.price.amount
            slot.price_currency = slot_in.price.currency

        slot = await self.repository.save_slot(slot)
        return DetailResponse(data=slot_to_public(slot))

    async def close_my_slot(
        self,
        *,
        guide_id: uuid.UUID,
        tour_id: str,
        slot_id: str,
    ) -> TourSlotResponse:
        await self._get_guide_tour(guide_id=guide_id, tour_id=tour_id)
        slot = await self.repository.get_slot(slot_id)
        if not slot or slot.tour_id != tour_id:
            raise HTTPException(status_code=404, detail="Slot not found")
        slot.status = SlotStatus.CANCELLED
        slot.available_capacity = 0
        slot = await self.repository.save_slot(slot)
        return DetailResponse(data=slot_to_public(slot))

    async def _apply_runtime_ratings(self, tours: Sequence[Tour]) -> list[Tour]:
        if not tours:
            return []
        tour_ids = [tour.id for tour in tours]
        guide_ids = list(dict.fromkeys(tour.guide_id for tour in tours))
        tour_stats = await self.repository.get_tour_rating_stats_map(tour_ids=tour_ids)
        guide_stats = await self.repository.get_guide_rating_stats_map(guide_ids=guide_ids)
        return [
            self._tour_with_rating_stats(
                tour,
                rating_stats=tour_stats.get(tour.id),
                guide_rating_stats=guide_stats.get(tour.guide_id),
            )
            for tour in tours
        ]

    async def _apply_runtime_rating(self, tour: Tour) -> Tour:
        [enriched_tour] = await self._apply_runtime_ratings([tour])
        return enriched_tour

    def _tour_with_rating_stats(
        self,
        tour: Tour,
        *,
        rating_stats: tuple[float, int] | None,
        guide_rating_stats: tuple[float, int] | None,
    ) -> Tour:
        rating, reviews_count = rating_stats or (0.0, 0)
        guide_rating, guide_reviews_count = guide_rating_stats or (0.0, 0)
        return tour.model_copy(
            update={
                "rating": rating,
                "reviews_count": reviews_count,
                "guide_rating": guide_rating,
                "guide_reviews_count": guide_reviews_count,
            },
        )

    async def _get_guide_tour(self, guide_id: uuid.UUID, tour_id: str) -> Tour:
        tour = await self.repository.get_by_id(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        if tour.guide_id != str(guide_id):
            raise HTTPException(status_code=403, detail="Not authorized to manage this tour")
        return tour

    async def _moderate_tour(
        self,
        tour_id: str,
        admin_id: uuid.UUID,
        status: TourStatus,
        reason: str | None,
    ) -> TourResponse:
        tour = await self.repository.get_by_id(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        tour.status = status
        tour.moderation_reason = reason
        tour.moderated_by = admin_id
        tour.moderated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        tour = await self.repository.save_tour(tour)
        tour = await self._apply_runtime_rating(tour)
        return DetailResponse(data=tour_to_detail(tour))
