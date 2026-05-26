from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select, update

from src.app.db.models.booking import Booking
from src.app.db.models.poe import Poe
from src.app.db.models.review import Review, ReviewEntityType
from src.app.db.models.tour import Tour
from src.app.repositories.base import BaseRepository


class ReviewRepository(BaseRepository[Review]):
    model = Review

    async def list_reviews(
        self,
        *,
        entity_type: ReviewEntityType,
        entity_id: str,
        skip: int,
        limit: int,
        rating: int | None = None,
    ) -> tuple[Sequence[Review], int]:
        statement = select(Review).where(
            Review.entity_type == entity_type,
            Review.entity_id == entity_id,
        )
        if rating is not None:
            statement = statement.where(Review.rating == rating)
        statement = statement.order_by(Review.created_at.desc())
        items = (await self.session.execute(statement.offset(skip).limit(limit))).scalars().all()

        total_statement = select(func.count()).select_from(Review).where(
            Review.entity_type == entity_type,
            Review.entity_id == entity_id,
        )
        if rating is not None:
            total_statement = total_statement.where(Review.rating == rating)
        total = (await self.session.execute(total_statement)).scalar_one()
        return items, total

    async def list_user_reviews(
        self,
        *,
        user_id: UUID,
        skip: int,
        limit: int,
        entity_type: ReviewEntityType | None = None,
    ) -> tuple[Sequence[Review], int]:
        statement = select(Review).where(Review.user_id == user_id)
        if entity_type is not None:
            statement = statement.where(Review.entity_type == entity_type)
        statement = statement.order_by(Review.created_at.desc())
        items = (await self.session.execute(statement.offset(skip).limit(limit))).scalars().all()

        total_statement = select(func.count()).select_from(Review).where(Review.user_id == user_id)
        if entity_type is not None:
            total_statement = total_statement.where(Review.entity_type == entity_type)
        total = (await self.session.execute(total_statement)).scalar_one()
        return items, total

    async def get_tour(self, tour_id: str) -> Tour | None:
        return await self.session.get(Tour, tour_id)

    async def get_poe(self, poe_id: str) -> Poe | None:
        return await self.session.get(Poe, poe_id)

    async def get_tours_map(self, ids: list[str]) -> dict[str, Tour]:
        if not ids:
            return {}
        statement = select(Tour).where(Tour.id.in_(ids))
        rows = (await self.session.execute(statement)).scalars().all()
        return {tour.id: tour for tour in rows}

    async def get_poes_map(self, ids: list[str]) -> dict[str, Poe]:
        if not ids:
            return {}
        statement = select(Poe).where(Poe.id.in_(ids))
        rows = (await self.session.execute(statement)).scalars().all()
        return {poe.id: poe for poe in rows}

    async def get_booking(self, booking_id: str) -> Booking | None:
        return await self.session.get(Booking, booking_id)

    async def get_user_tour_review(self, booking_id: str, user_id: UUID) -> Review | None:
        statement = select(Review).where(
            Review.booking_id == booking_id,
            Review.user_id == user_id,
            Review.entity_type == ReviewEntityType.TOUR,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_user_review(self, review_id: str, user_id: UUID) -> Review | None:
        statement = select(Review).where(
            Review.id == review_id,
            Review.user_id == user_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def add_and_recalculate(
        self,
        *,
        review: Review,
        entity_type: ReviewEntityType,
        entity_id: str,
    ) -> Review:
        self.session.add(review)
        await self.session.flush()

        avg_rating_statement = select(
            func.coalesce(func.avg(Review.rating), 0.0),
            func.count(Review.id),
        ).where(
            Review.entity_type == entity_type,
            Review.entity_id == entity_id,
        )
        avg_rating, reviews_count = (await self.session.execute(avg_rating_statement)).one()

        if entity_type == ReviewEntityType.POE:
            await self.session.execute(
                update(Poe)
                .where(Poe.id == entity_id)
                .values(rating=float(avg_rating), reviews_count=int(reviews_count)),
            )
        else:
            tour = await self.get_tour(entity_id)
            if tour is not None:
                await self.session.execute(
                    update(Tour)
                    .where(Tour.id == entity_id)
                    .values(rating=float(avg_rating), reviews_count=int(reviews_count)),
                )
                guide_avg_statement = select(
                    func.coalesce(func.avg(Tour.rating), 0.0),
                    func.coalesce(func.sum(Tour.reviews_count), 0),
                ).where(Tour.guide_id == tour.guide_id)
                guide_avg, guide_reviews_count = (
                    await self.session.execute(guide_avg_statement)
                ).one()
                await self.session.execute(
                    update(Tour)
                    .where(Tour.guide_id == tour.guide_id)
                    .values(
                        guide_rating=float(guide_avg),
                        guide_reviews_count=int(guide_reviews_count),
                    ),
                )

        await self.session.commit()
        return review

    async def list_admin_reviews(
        self,
        skip: int,
        limit: int,
        suspicious: bool | None = None,
        hidden: bool | None = None,
    ) -> tuple[Sequence[Review], int]:
        statement = select(Review)
        total_statement = select(func.count()).select_from(Review)
        if suspicious is not None:
            statement = statement.where(Review.suspicious == suspicious)
            total_statement = total_statement.where(Review.suspicious == suspicious)
        if hidden is not None:
            statement = statement.where(Review.hidden == hidden)
            total_statement = total_statement.where(Review.hidden == hidden)
        statement = statement.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total

    async def list_guide_reviews(
        self,
        *,
        guide_id: str,
        skip: int,
        limit: int,
        rating: int | None = None,
    ) -> tuple[Sequence[Review], int]:
        statement = (
            select(Review)
            .join(Tour, Tour.id == Review.entity_id)
            .where(
                Review.entity_type == ReviewEntityType.TOUR,
                Tour.guide_id == guide_id,
            )
        )
        total_statement = (
            select(func.count())
            .select_from(Review)
            .join(Tour, Tour.id == Review.entity_id)
            .where(
                Review.entity_type == ReviewEntityType.TOUR,
                Tour.guide_id == guide_id,
            )
        )
        if rating is not None:
            statement = statement.where(Review.rating == rating)
            total_statement = total_statement.where(Review.rating == rating)
        statement = statement.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total
