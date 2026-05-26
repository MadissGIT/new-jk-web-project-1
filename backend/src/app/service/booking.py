import datetime
import uuid

from fastapi import HTTPException

from src.app.db.models.booking import (
    Booking,
    BookingCancelledPublic,
    BookingCancelRequest,
    BookingCancelResponse,
    BookingCreate,
    BookingCreatedPublic,
    BookingCreateResponse,
    BookingDetail,
    GuideBookingPublic,
    GuideBookingsPublic,
    BookingPublic,
    BookingResponse,
    BookingSlotDetail,
    BookingSlotShort,
    BookingsPublic,
    BookingStatus,
    BookingTourShort,
    MockPaymentPublic,
    MockPaymentResponse,
    PaymentPublic,
    RefundStatus,
)
from src.app.db.models.tour import Price, SlotStatus, Tour, TourSlot
from src.app.db.schemas import DetailResponse, PaginationMeta
from src.app.repositories.booking import BookingRepository
from src.app.core.datetime import app_now
from src.app.service.base import BaseService


def booking_price(booking: Booking) -> Price:
    return Price(
        amount=booking.price_total_amount,
        currency=booking.price_total_currency,
    )


def booking_to_created(booking: Booking) -> BookingCreatedPublic:
    return BookingCreatedPublic(
        id=booking.id,
        tour_id=booking.tour_id,
        slot_id=booking.slot_id,
        user_id=booking.user_id,
        participants_count=booking.participants_count,
        status=booking.status,
        price_total=booking_price(booking),
        payment=PaymentPublic(
            payment_id=booking.payment_id,
            payment_url=booking.payment_url,
        ),
        created_at=booking.created_at,
    )


def booking_to_public(booking: Booking, tour: Tour, slot: TourSlot) -> BookingPublic:
    return BookingPublic(
        id=booking.id,
        tour=BookingTourShort(id=tour.id, title=tour.title),
        slot=BookingSlotShort(id=slot.id, starts_at=slot.starts_at),
        participants_count=booking.participants_count,
        status=booking.status,
        price_total=booking_price(booking),
        contact_phone=booking.contact_phone,
        comment=booking.comment,
    )


def booking_to_guide_public(
    booking: Booking,
    tour: Tour,
    slot: TourSlot,
    *,
    customer_name: str,
) -> GuideBookingPublic:
    return GuideBookingPublic(
        **booking_to_public(booking, tour, slot).model_dump(),
        customer_name=customer_name,
    )


def booking_to_detail(booking: Booking, tour: Tour, slot: TourSlot) -> BookingDetail:
    public = booking_to_public(booking, tour, slot)
    public_data = public.model_dump()
    public_data["slot"] = BookingSlotDetail(
        id=slot.id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
    )
    return BookingDetail(
        **public_data,
        meeting_point={"address": tour.meeting_address},
    )


class BookingService(BaseService[BookingRepository]):
    async def create_booking(
        self,
        *,
        booking_in: BookingCreate,
        user_id: uuid.UUID,
        api_prefix: str,
    ) -> BookingCreateResponse:
        if booking_in.idempotency_key:
            existing_booking = await self.repository.get_by_idempotency_key(
                user_id=user_id,
                idempotency_key=booking_in.idempotency_key,
            )
            if existing_booking:
                return DetailResponse(data=booking_to_created(existing_booking))

        tour = await self.repository.get_tour(booking_in.tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        slot = await self.repository.get_slot(booking_in.slot_id)
        if not slot or slot.tour_id != tour.id:
            raise HTTPException(status_code=404, detail="Slot not found")
        now = app_now()
        if slot.ends_at <= now:
            raise HTTPException(status_code=409, detail="Tour slot has already ended")
        if slot.starts_at <= now:
            raise HTTPException(status_code=409, detail="Tour slot has already started")
        if slot.status != SlotStatus.AVAILABLE or slot.available_capacity <= 0:
            raise HTTPException(status_code=409, detail="Selected slot is unavailable")
        if slot.available_capacity < booking_in.participants_count:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Not enough capacity",
                    "available_capacity": slot.available_capacity,
                },
            )

        total_amount = slot.price_amount * booking_in.participants_count
        booking = Booking(
            tour_id=tour.id,
            slot_id=slot.id,
            user_id=user_id,
            participants_count=booking_in.participants_count,
            price_total_amount=total_amount,
            price_total_currency=slot.price_currency,
            payment_url="",
            contact_phone=booking_in.contact_phone,
            comment=booking_in.comment,
            idempotency_key=booking_in.idempotency_key,
        )
        booking.payment_url = f"{api_prefix}/bookings/{booking.id}/mock-payment/confirm"
        booking_public = booking_to_created(booking)
        created_booking = await self.repository.add_booking_with_slot_update(
            booking=booking,
            slot=slot,
        )
        if not created_booking:
            raise HTTPException(status_code=409, detail="Selected slot is unavailable")
        return DetailResponse(data=booking_public)

    async def get_bookings(
        self,
        *,
        user_id: uuid.UUID,
        page: int,
        limit: int,
        status: BookingStatus | None = None,
    ) -> BookingsPublic:
        bookings, total = await self.repository.list_user_bookings(
            user_id=user_id,
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
        )
        return BookingsPublic(
            data=[await self._booking_to_public(booking) for booking in bookings],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_guide_bookings(
        self,
        *,
        guide_id: uuid.UUID,
        page: int,
        limit: int,
        status: BookingStatus | None = None,
        tour_id: str | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> GuideBookingsPublic:
        bookings, total = await self.repository.list_guide_bookings(
            guide_id=str(guide_id),
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
            tour_id=tour_id,
            date_from=date_from,
            date_to=date_to,
        )
        user_ids = list({booking.user_id for booking in bookings})
        users_map = await self.repository.get_users_map(user_ids)
        items: list[GuideBookingPublic] = []
        for booking in bookings:
            tour = await self._get_booking_tour(booking)
            slot = await self._get_booking_slot(booking)
            user = users_map.get(booking.user_id)
            customer_name = " ".join(
                part for part in [user.surname, user.name] if user and part
            ).strip() or (user.email if user else "Гость")
            items.append(
                booking_to_guide_public(
                    booking,
                    tour,
                    slot,
                    customer_name=customer_name,
                ),
            )
        return GuideBookingsPublic(
            data=items,
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_booking(
        self,
        *,
        booking_id: str,
        user_id: uuid.UUID,
    ) -> BookingResponse:
        booking = await self._get_user_booking(booking_id=booking_id, user_id=user_id)
        tour = await self._get_booking_tour(booking)
        slot = await self._get_booking_slot(booking)
        return DetailResponse(data=booking_to_detail(booking, tour, slot))

    async def confirm_mock_payment(
        self,
        *,
        booking_id: str,
        user_id: uuid.UUID,
    ) -> MockPaymentResponse:
        booking = await self._get_user_booking(booking_id=booking_id, user_id=user_id)
        if booking.status == BookingStatus.CONFIRMED:
            return DetailResponse(data=self._mock_payment_public(booking))
        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise HTTPException(status_code=409, detail="Booking cannot be paid in current status")
        booking.status = BookingStatus.CONFIRMED
        payment_public = self._mock_payment_public(booking)
        await self.repository.save_booking_and_slot(booking=booking)
        return DetailResponse(data=payment_public)

    async def cancel_booking(
        self,
        *,
        booking_id: str,
        user_id: uuid.UUID,
        cancel_in: BookingCancelRequest,
    ) -> BookingCancelResponse:
        booking = await self._get_user_booking(booking_id=booking_id, user_id=user_id)
        if booking.status in {BookingStatus.CANCELLED, BookingStatus.REFUNDED}:
            refund_status = booking.refund_status or RefundStatus.NOT_REQUIRED
            return DetailResponse(
                data=BookingCancelledPublic(
                    id=booking.id,
                    status=BookingStatus.CANCELLED,
                    refund_status=refund_status,
                ),
            )
        if booking.status in {BookingStatus.COMPLETED}:
            raise HTTPException(status_code=409, detail="Completed booking cannot be cancelled")

        slot = await self.repository.get_slot(booking.slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
        slot.available_capacity += booking.participants_count
        if slot.status == SlotStatus.SOLD_OUT:
            slot.status = SlotStatus.AVAILABLE

        should_refund = booking.status == BookingStatus.CONFIRMED
        booking.status = BookingStatus.CANCELLED
        booking.cancel_reason = cancel_in.reason
        booking.refund_status = (
            RefundStatus.PENDING
            if should_refund
            else RefundStatus.NOT_REQUIRED
        )
        cancelled_public = BookingCancelledPublic(
            id=booking.id,
            status=booking.status,
            refund_status=booking.refund_status,
        )
        await self.repository.save_booking_and_slot(booking=booking, slot=slot)
        return DetailResponse(data=cancelled_public)

    async def refund_mock_payment(
        self,
        *,
        booking_id: str,
        user_id: uuid.UUID,
    ) -> MockPaymentResponse:
        booking = await self._get_user_booking(booking_id=booking_id, user_id=user_id)
        if booking.status == BookingStatus.REFUNDED:
            return DetailResponse(data=self._mock_payment_public(booking))
        if (
            booking.status != BookingStatus.CANCELLED
            or booking.refund_status != RefundStatus.PENDING
        ):
            raise HTTPException(
                status_code=409,
                detail="Booking cannot be refunded in current status",
            )
        booking.status = BookingStatus.REFUNDED
        booking.refund_status = RefundStatus.REFUNDED
        payment_public = self._mock_payment_public(booking)
        await self.repository.save_booking_and_slot(booking=booking)
        return DetailResponse(data=payment_public)

    async def confirm_booking_by_guide(
        self,
        *,
        booking_id: str,
        guide_id: uuid.UUID,
    ) -> BookingResponse:
        booking, tour, slot = await self._get_guide_booking_context(
            booking_id=booking_id,
            guide_id=guide_id,
        )
        if booking.status == BookingStatus.CONFIRMED:
            return DetailResponse(data=booking_to_detail(booking, tour, slot))
        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise HTTPException(
                status_code=409,
                detail="Booking cannot be confirmed in current status",
            )
        booking.status = BookingStatus.CONFIRMED
        detail_public = booking_to_detail(booking, tour, slot)
        await self.repository.save_booking_and_slot(booking=booking)
        return DetailResponse(data=detail_public)

    async def cancel_booking_by_guide(
        self,
        *,
        booking_id: str,
        guide_id: uuid.UUID,
    ) -> BookingCancelResponse:
        booking, _, slot = await self._get_guide_booking_context(
            booking_id=booking_id,
            guide_id=guide_id,
        )
        if booking.status in {BookingStatus.CANCELLED, BookingStatus.REFUNDED}:
            refund_status = booking.refund_status or RefundStatus.NOT_REQUIRED
            return DetailResponse(
                data=BookingCancelledPublic(
                    id=booking.id,
                    status=BookingStatus.CANCELLED,
                    refund_status=refund_status,
                ),
            )
        if booking.status in {BookingStatus.COMPLETED}:
            raise HTTPException(status_code=409, detail="Completed booking cannot be cancelled")

        slot.available_capacity += booking.participants_count
        if slot.status == SlotStatus.SOLD_OUT:
            slot.status = SlotStatus.AVAILABLE

        should_refund = booking.status == BookingStatus.CONFIRMED
        booking.status = BookingStatus.CANCELLED
        booking.cancel_reason = "Cancelled by guide"
        booking.refund_status = RefundStatus.PENDING if should_refund else RefundStatus.NOT_REQUIRED
        cancelled_public = BookingCancelledPublic(
            id=booking.id,
            status=booking.status,
            refund_status=booking.refund_status,
        )
        await self.repository.save_booking_and_slot(booking=booking, slot=slot)
        return DetailResponse(data=cancelled_public)

    async def get_admin_bookings(
        self,
        page: int,
        limit: int,
        user_id: uuid.UUID | None = None,
        tour_id: str | None = None,
        status: BookingStatus | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> BookingsPublic:
        bookings, total = await self.repository.list_admin_bookings(
            skip=(page - 1) * limit,
            limit=limit,
            user_id=user_id,
            tour_id=tour_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )
        return BookingsPublic(
            data=[await self._booking_to_public(booking) for booking in bookings],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def _booking_to_public(self, booking: Booking) -> BookingPublic:
        tour = await self._get_booking_tour(booking)
        slot = await self._get_booking_slot(booking)
        return booking_to_public(booking, tour, slot)

    async def _get_user_booking(self, booking_id: str, user_id: uuid.UUID) -> Booking:
        booking = await self.repository.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access booking")
        return booking

    async def _get_booking_tour(self, booking: Booking) -> Tour:
        tour = await self.repository.get_tour(booking.tour_id)
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        return tour

    async def _get_booking_slot(self, booking: Booking) -> TourSlot:
        slot = await self.repository.get_slot(booking.slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
        return slot

    async def _get_guide_booking_context(
        self,
        *,
        booking_id: str,
        guide_id: uuid.UUID,
    ) -> tuple[Booking, Tour, TourSlot]:
        booking = await self.repository.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        tour = await self._get_booking_tour(booking)
        if tour.guide_id != str(guide_id):
            raise HTTPException(status_code=403, detail="Not authorized to manage booking")
        slot = await self._get_booking_slot(booking)
        return booking, tour, slot

    def _mock_payment_public(self, booking: Booking) -> MockPaymentPublic:
        return MockPaymentPublic(
            booking_id=booking.id,
            payment_id=booking.payment_id,
            status=booking.status,
        )
