
from fastapi import HTTPException

from src.app.db.models.booking import BookingStatus
from src.app.db.models.review import (
    PoeReviewCreate,
    Review,
    ReviewCreatedPublic,
    ReviewEntityType,
    ReviewModerationDecision,
    ReviewPublic,
    ReviewResponse,
    ReviewsPublic,
    ReviewUserPublic,
    TourReviewCreate,
)
from src.app.db.models.user import User
from src.app.db.schemas import DetailResponse, PaginationMeta
from src.app.repositories.review import ReviewRepository
from src.app.service.base import BaseService


def review_to_public(
    review: Review,
    *,
    entity_title: str | None = None,
) -> ReviewPublic:
    return ReviewPublic(
        id=review.id,
        user=ReviewUserPublic(id=review.user_id, name=review.user_name),
        rating=review.rating,
        text=review.text,
        created_at=review.created_at,
        entity_type=review.entity_type,
        entity_id=review.entity_id,
        entity_title=entity_title,
    )


def _review_entity_title(
    review: Review,
    *,
    tours_map: dict,
    poes_map: dict,
) -> str | None:
    if review.entity_type == ReviewEntityType.TOUR:
        tour = tours_map.get(review.entity_id)
        return tour.title if tour else None
    if review.entity_type == ReviewEntityType.POE:
        poe = poes_map.get(review.entity_id)
        return poe.title if poe else None
    return None


def review_to_created(review: Review) -> ReviewCreatedPublic:
    return ReviewCreatedPublic(
        id=review.id,
        rating=review.rating,
        text=review.text,
        accessibility_rating=review.accessibility_rating,
        created_at=review.created_at,
    )


class ReviewService(BaseService[ReviewRepository]):
    async def get_my_reviews(
        self,
        *,
        user_id,
        page: int,
        limit: int,
        entity_type: ReviewEntityType | None = None,
    ) -> ReviewsPublic:
        reviews, total = await self.repository.list_user_reviews(
            user_id=user_id,
            skip=(page - 1) * limit,
            limit=limit,
            entity_type=entity_type,
        )
        tour_ids = [
            review.entity_id
            for review in reviews
            if review.entity_type == ReviewEntityType.TOUR
        ]
        poe_ids = [
            review.entity_id
            for review in reviews
            if review.entity_type == ReviewEntityType.POE
        ]
        tours_map = await self.repository.get_tours_map(ids=tour_ids)
        poes_map = await self.repository.get_poes_map(ids=poe_ids)
        return ReviewsPublic(
            data=[
                review_to_public(
                    review,
                    entity_title=_review_entity_title(
                        review,
                        tours_map=tours_map,
                        poes_map=poes_map,
                    ),
                )
                for review in reviews
            ],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_tour_reviews(
        self,
        *,
        tour_id: str,
        page: int,
        limit: int,
        rating: int | None = None,
    ) -> ReviewsPublic:
        tour = await self.repository.get_tour(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        reviews, total = await self.repository.list_reviews(
            entity_type=ReviewEntityType.TOUR,
            entity_id=tour_id,
            skip=(page - 1) * limit,
            limit=limit,
            rating=rating,
        )
        return ReviewsPublic(
            data=[review_to_public(review) for review in reviews],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_poe_reviews(
        self,
        *,
        poe_id: str,
        page: int,
        limit: int,
        rating: int | None = None,
    ) -> ReviewsPublic:
        poe = await self.repository.get_poe(poe_id)
        if not poe:
            raise HTTPException(status_code=404, detail="POE not found")
        reviews, total = await self.repository.list_reviews(
            entity_type=ReviewEntityType.POE,
            entity_id=poe_id,
            skip=(page - 1) * limit,
            limit=limit,
            rating=rating,
        )
        return ReviewsPublic(
            data=[review_to_public(review) for review in reviews],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def create_tour_review(
        self,
        *,
        tour_id: str,
        review_in: TourReviewCreate,
        current_user: User,
    ) -> ReviewResponse:
        tour = await self.repository.get_tour(tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        booking = await self.repository.get_booking(review_in.booking_id)
        if not booking or booking.tour_id != tour_id:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to review this booking")
        if booking.status not in {
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.REFUNDED,
        }:
            raise HTTPException(status_code=409, detail="Booking is not eligible for review")
        existing_review = await self.repository.get_user_tour_review(
            booking_id=review_in.booking_id,
            user_id=current_user.id,
        )
        if existing_review:
            raise HTTPException(status_code=409, detail="Review for this booking already exists")

        review = Review(
            entity_type=ReviewEntityType.TOUR,
            entity_id=tour_id,
            user_id=current_user.id,
            user_name=current_user.name,
            booking_id=review_in.booking_id,
            rating=review_in.rating,
            text=review_in.text,
            accessibility_rating=review_in.accessibility_rating,
        )
        review_public = review_to_created(review)
        await self.repository.add_and_recalculate(
            review=review,
            entity_type=ReviewEntityType.TOUR,
            entity_id=tour_id,
        )
        return DetailResponse(data=review_public)

    async def create_poe_review(
        self,
        *,
        poe_id: str,
        review_in: PoeReviewCreate,
        current_user: User,
    ) -> ReviewResponse:
        poe = await self.repository.get_poe(poe_id)
        if not poe:
            raise HTTPException(status_code=404, detail="POE not found")
        review = Review(
            entity_type=ReviewEntityType.POE,
            entity_id=poe_id,
            user_id=current_user.id,
            user_name=current_user.name,
            rating=review_in.rating,
            text=review_in.text,
            accessibility_rating=review_in.accessibility_rating,
        )
        review_public = review_to_created(review)
        await self.repository.add_and_recalculate(
            review=review,
            entity_type=ReviewEntityType.POE,
            entity_id=poe_id,
        )
        return DetailResponse(data=review_public)

    async def get_admin_reviews(
        self,
        page: int,
        limit: int,
        suspicious: bool | None = None,
        hidden: bool | None = None,
    ) -> ReviewsPublic:
        reviews, total = await self.repository.list_admin_reviews(
            skip=(page - 1) * limit,
            limit=limit,
            suspicious=suspicious,
            hidden=hidden,
        )
        return ReviewsPublic(
            data=[review_to_public(review) for review in reviews],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_guide_reviews(
        self,
        *,
        guide_id: str,
        page: int,
        limit: int,
        rating: int | None = None,
    ) -> ReviewsPublic:
        reviews, total = await self.repository.list_guide_reviews(
            guide_id=guide_id,
            skip=(page - 1) * limit,
            limit=limit,
            rating=rating,
        )
        return ReviewsPublic(
            data=[review_to_public(review) for review in reviews],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def hide_review(
        self,
        review_id: str,
        decision_in: ReviewModerationDecision,
    ) -> ReviewResponse:
        review = await self.repository.get_by_id(review_id)
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        review.hidden = True
        if decision_in.suspicious is not None:
            review.suspicious = decision_in.suspicious
        if decision_in.reported_count is not None:
            review.reported_count = decision_in.reported_count
        review = await self.repository.add(review)
        return DetailResponse(data=review_to_created(review))

    async def delete_review(self, review_id: str) -> DetailResponse[dict[str, str]]:
        review = await self.repository.get_by_id(review_id)
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        await self.repository.delete(review)
        return DetailResponse(data={"id": review_id, "status": "deleted"})

    async def delete_my_review(self, review_id: str, user_id) -> DetailResponse[dict[str, str]]:
        review = await self.repository.get_user_review(review_id, user_id)
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        await self.repository.delete(review)
        return DetailResponse(data={"id": review_id, "status": "deleted"})
