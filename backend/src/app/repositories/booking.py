import datetime
import uuid
from collections.abc import Sequence

from sqlalchemy import func, select, update

from src.app.db.models.booking import Booking, BookingStatus
from src.app.db.models.tour import SlotStatus, Tour, TourSlot
from src.app.db.models.user import User
from src.app.repositories.base import BaseRepository


class BookingRepository(BaseRepository[Booking]):
    model = Booking

    async def get_tour(self, tour_id: str) -> Tour | None:
        return await self.session.get(Tour, tour_id)

    async def get_slot(self, slot_id: str) -> TourSlot | None:
        return await self.session.get(TourSlot, slot_id)

    async def get_users_map(self, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, User]:
        if not user_ids:
            return {}
        statement = select(User).where(User.id.in_(user_ids))
        rows = (await self.session.execute(statement)).scalars().all()
        return {user.id: user for user in rows}

    async def get_by_idempotency_key(
        self,
        *,
        user_id: uuid.UUID,
        idempotency_key: str,
    ) -> Booking | None:
        statement = select(Booking).where(
            Booking.user_id == user_id,
            Booking.idempotency_key == idempotency_key,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def list_user_bookings(
        self,
        *,
        user_id: uuid.UUID,
        skip: int,
        limit: int,
        status: BookingStatus | None = None,
    ) -> tuple[Sequence[Booking], int]:
        statement = select(Booking).where(Booking.user_id == user_id)
        if status:
            statement = statement.where(Booking.status == status)
        statement = statement.order_by(Booking.created_at.desc())
        items = (await self.session.execute(statement.offset(skip).limit(limit))).scalars().all()

        total_statement = (
            select(func.count())
            .select_from(Booking)
            .where(Booking.user_id == user_id)
        )
        if status:
            total_statement = total_statement.where(Booking.status == status)
        total = (await self.session.execute(total_statement)).scalar_one()
        return items, total

    async def list_guide_bookings(
        self,
        *,
        guide_id: str,
        skip: int,
        limit: int,
        status: BookingStatus | None = None,
        tour_id: str | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> tuple[Sequence[Booking], int]:
        statement = (
            select(Booking)
            .join(Tour, Tour.id == Booking.tour_id)
            .join(TourSlot, TourSlot.id == Booking.slot_id)
            .where(Tour.guide_id == guide_id)
        )
        if status:
            statement = statement.where(Booking.status == status)
        if tour_id:
            statement = statement.where(Booking.tour_id == tour_id)
        if date_from is not None:
            statement = statement.where(TourSlot.starts_at >= date_from)
        if date_to is not None:
            statement = statement.where(TourSlot.starts_at <= date_to)
        statement = statement.order_by(Booking.created_at.desc())
        items = (await self.session.execute(statement.offset(skip).limit(limit))).scalars().all()

        total_statement = (
            select(func.count())
            .select_from(Booking)
            .join(Tour, Tour.id == Booking.tour_id)
            .join(TourSlot, TourSlot.id == Booking.slot_id)
            .where(Tour.guide_id == guide_id)
        )
        if status:
            total_statement = total_statement.where(Booking.status == status)
        if tour_id:
            total_statement = total_statement.where(Booking.tour_id == tour_id)
        if date_from is not None:
            total_statement = total_statement.where(TourSlot.starts_at >= date_from)
        if date_to is not None:
            total_statement = total_statement.where(TourSlot.starts_at <= date_to)

        total = (await self.session.execute(total_statement)).scalar_one()
        return items, total

    async def add_booking_with_slot_update(
        self,
        *,
        booking: Booking,
        slot: TourSlot,
    ) -> Booking | None:
        statement = (
            update(TourSlot)
            .where(
                TourSlot.id == slot.id,
                TourSlot.status == SlotStatus.AVAILABLE,
                TourSlot.available_capacity >= booking.participants_count,
            )
            .values(available_capacity=TourSlot.available_capacity - booking.participants_count)
            .returning(TourSlot.available_capacity)
        )
        remaining_capacity = (await self.session.execute(statement)).scalar_one_or_none()
        if remaining_capacity is None:
            await self.session.rollback()
            return None
        if remaining_capacity == 0:
            await self.session.execute(
                update(TourSlot)
                .where(TourSlot.id == slot.id)
                .values(status=SlotStatus.SOLD_OUT),
            )
        self.session.add(booking)
        await self.session.commit()
        await self.session.refresh(booking)
        return booking

    async def save_booking_and_slot(
        self,
        *,
        booking: Booking,
        slot: TourSlot | None = None,
    ) -> Booking:
        if slot:
            self.session.add(slot)
        self.session.add(booking)
        await self.session.commit()
        await self.session.refresh(booking)
        return booking

    async def list_admin_bookings(
        self,
        skip: int,
        limit: int,
        user_id: uuid.UUID | None = None,
        tour_id: str | None = None,
        status: BookingStatus | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> tuple[Sequence[Booking], int]:
        statement = select(Booking).join(TourSlot, TourSlot.id == Booking.slot_id)
        total_statement = (
            select(func.count())
            .select_from(Booking)
            .join(TourSlot, TourSlot.id == Booking.slot_id)
        )
        if user_id is not None:
            statement = statement.where(Booking.user_id == user_id)
            total_statement = total_statement.where(Booking.user_id == user_id)
        if tour_id is not None:
            statement = statement.where(Booking.tour_id == tour_id)
            total_statement = total_statement.where(Booking.tour_id == tour_id)
        if status is not None:
            statement = statement.where(Booking.status == status)
            total_statement = total_statement.where(Booking.status == status)
        if date_from is not None:
            statement = statement.where(TourSlot.starts_at >= date_from)
            total_statement = total_statement.where(TourSlot.starts_at >= date_from)
        if date_to is not None:
            statement = statement.where(TourSlot.starts_at <= date_to)
            total_statement = total_statement.where(TourSlot.starts_at <= date_to)
        statement = statement.order_by(Booking.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total
