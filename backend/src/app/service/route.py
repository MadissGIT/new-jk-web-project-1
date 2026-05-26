import datetime
import uuid

from fastapi import HTTPException

from src.app.db.models.poe import Location, Poe
from src.app.db.models.route import (
    Pace,
    Route,
    RouteAccessibilityRequest,
    RouteDetailPublic,
    RouteGeneratedPublic,
    RouteGenerateRequest,
    RouteGenerateResponse,
    RouteJourneyPublic,
    RouteJourneyResponse,
    RouteListItemPublic,
    RouteManualUpdate,
    RoutePoeShort,
    RoutePoint,
    RoutePointDetailPublic,
    RoutePointEdit,
    RoutePointPublic,
    RouteProgressUpdate,
    RouteResponse,
    RouteSavedPublic,
    RouteSaveResponse,
    RouteScenarioPublic,
    RouteScenariosPublic,
    RouteSource,
    RoutesPublic,
    RouteStatus,
)
from src.app.db.schemas import DetailResponse, PaginationMeta
from src.app.repositories.poe import PoeRepository
from src.app.repositories.route import RouteRepository
from src.app.service.base import BaseService
from src.app.service.poe import distance_meters

PACE_WALKING_SPEED_METERS_PER_MINUTE = {
    Pace.SLOW: 55,
    Pace.MEDIUM: 75,
    Pace.FAST: 95,
}

NOISY_POE_MARKERS = {
    "bar",
    "club",
    "concert",
    "dance",
    "dj",
    "loud",
    "music",
    "night",
    "party",
    "бар",
    "вечерин",
    "громк",
    "диджей",
    "клуб",
    "концерт",
    "музык",
    "ночн",
    "танц",
}


class RouteService(BaseService[RouteRepository]):
    def __init__(self, repository: RouteRepository, poe_repository: PoeRepository) -> None:
        super().__init__(repository)
        self.poe_repository = poe_repository

    async def generate_route(
        self,
        request: RouteGenerateRequest,
        *,
        user_id: uuid.UUID,
    ) -> RouteGenerateResponse:
        candidates = await self.poe_repository.list_candidates(
            city_id=request.city_id,
            wheelchair_accessible=True if request.accessibility.wheelchair_required else None,
            requires_ramp=request.accessibility.requires_ramp,
            avoid_stairs=request.accessibility.avoid_stairs,
        )
        selected = self._select_points(request, list(candidates))
        if not selected:
            raise HTTPException(status_code=404, detail="No POE candidates found for route")
        route_distance = self._route_distance(request, selected)
        accessibility_score = self._accessibility_score(selected)
        route = Route(
            user_id=user_id,
            title=self._build_title(request, selected),
            description=f"Маршрут на {request.duration_minutes // 60 or 1} ч. по городу",
            city_id=request.city_id,
            duration_minutes=request.duration_minutes,
            distance_meters=route_distance,
            pace=request.pace,
            start_lat=request.start_location.lat,
            start_lng=request.start_location.lng,
            start_address=request.start_location.address,
            accessibility_score=accessibility_score,
        )
        points = [
            RoutePoint(
                route_id=route.id,
                order=index,
                poe_id=poe.id,
                planned_stop_minutes=poe.duration_minutes,
            )
            for index, poe in enumerate(selected, start=1)
        ]
        route_public = RouteGeneratedPublic(
            id=route.id,
            title=route.title,
            description=route.description,
            city_id=route.city_id,
            status=route.status,
            source=route.source,
            duration_minutes=route.duration_minutes,
            distance_meters=route.distance_meters,
            pace=route.pace,
            points=[
                RoutePointPublic(
                    order=point.order,
                    poe_id=point.poe_id,
                    planned_stop_minutes=point.planned_stop_minutes,
                )
                for point in points
            ],
            accessibility_score=route.accessibility_score,
        )
        await self.repository.create_with_points(route, points)
        return DetailResponse(data=route_public)

    async def get_routes(
        self,
        *,
        user_id: uuid.UUID,
        page: int,
        limit: int,
        status: RouteStatus | None = None,
        source: RouteSource | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> RoutesPublic:
        routes, total = await self.repository.list_user_routes(
            user_id=user_id,
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
            source=source,
            date_from=date_from,
            date_to=date_to,
        )
        return RoutesPublic(
            data=[
                RouteListItemPublic(
                    id=route.id,
                    title=route.title,
                    status=route.status,
                    source=route.source,
                    duration_minutes=route.duration_minutes,
                    distance_meters=route.distance_meters,
                    created_at=route.created_at,
                )
                for route in routes
            ],
            meta=PaginationMeta.create(page=page, limit=limit, total=total),
        )

    async def get_route_history(
        self,
        user_id: uuid.UUID,
        page: int,
        limit: int,
        status: RouteStatus | None = None,
        source: RouteSource | None = None,
        date_from: datetime.datetime | None = None,
        date_to: datetime.datetime | None = None,
    ) -> RoutesPublic:
        return await self.get_routes(
            user_id=user_id,
            page=page,
            limit=limit,
            status=status,
            source=source,
            date_from=date_from,
            date_to=date_to,
        )

    async def get_route(
        self,
        *,
        route_id: str,
        user_id: uuid.UUID,
    ) -> RouteResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        points = await self.repository.get_route_points(route_id=route.id)
        poes_map = await self.poe_repository.get_by_ids(ids=[point.poe_id for point in points])
        return DetailResponse(
            data=RouteDetailPublic(
                id=route.id,
                title=route.title,
                description=route.description,
                city_id=route.city_id,
                status=route.status,
                source=route.source,
                duration_minutes=route.duration_minutes,
                distance_meters=route.distance_meters,
                pace=route.pace,
                start_point=Location(
                    lat=route.start_lat or 0.0,
                    lng=route.start_lng or 0.0,
                    address=route.start_address,
                ),
                points=[
                    RoutePointDetailPublic(
                        order=point.order,
                        poe=RoutePoeShort(
                            id=poe.id,
                            title=poe.title,
                            category=poe.category,
                        ),
                        planned_stop_minutes=point.planned_stop_minutes,
                    )
                    for point in points
                    if (poe := poes_map.get(point.poe_id)) is not None
                ],
                accessibility_score=route.accessibility_score,
                created_at=route.created_at,
            ),
        )

    async def save_route(
        self,
        *,
        route_id: str,
        user_id: uuid.UUID,
    ) -> RouteSaveResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        route.status = RouteStatus.SAVED
        await self.repository.save_route(route)
        return DetailResponse(data=RouteSavedPublic(id=route.id, status=route.status))

    async def start_route(self, route_id: str, user_id: uuid.UUID) -> RouteJourneyResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        if route.status == RouteStatus.COMPLETED:
            raise HTTPException(status_code=409, detail="Completed route cannot be started")
        route.status = RouteStatus.IN_PROGRESS
        route.started_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        route.progress_order = max(route.progress_order, 1)
        route = await self.repository.save_route(route)
        return DetailResponse(data=self._journey_public(route))

    async def progress_route(
        self,
        route_id: str,
        user_id: uuid.UUID,
        progress_in: RouteProgressUpdate,
    ) -> RouteJourneyResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        if route.status != RouteStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Route is not in progress")
        points = await self.repository.get_route_points(route.id)
        if not points:
            raise HTTPException(status_code=409, detail="Route has no points")
        max_order = max(point.order for point in points)
        if progress_in.order > max_order:
            raise HTTPException(status_code=422, detail="Progress order exceeds route points count")
        route.progress_order = progress_in.order
        route = await self.repository.save_route(route)
        return DetailResponse(data=self._journey_public(route))

    async def finish_route(self, route_id: str, user_id: uuid.UUID) -> RouteJourneyResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        if route.status != RouteStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Route is not in progress")
        route.status = RouteStatus.COMPLETED
        route.completed_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        route = await self.repository.save_route(route)
        return DetailResponse(data=self._journey_public(route))

    async def update_route(
        self,
        route_id: str,
        user_id: uuid.UUID,
        route_in: RouteManualUpdate,
    ) -> RouteResponse:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        payload = route_in.model_dump(exclude_unset=True)
        points_payload = payload.pop("points", None)
        for key, value in payload.items():
            setattr(route, key, value)
        route.source = RouteSource.MANUAL
        route = await self.repository.save_route(route)

        if points_payload is not None:
            point_models = [RoutePointEdit.model_validate(item) for item in points_payload]
            poes_map = await self.poe_repository.get_by_ids(
                ids=[point.poe_id for point in point_models],
            )
            missing = [point.poe_id for point in point_models if point.poe_id not in poes_map]
            if missing:
                raise HTTPException(status_code=404, detail=f"POE not found: {missing[0]}")
            points = [
                RoutePoint(
                    route_id=route.id,
                    order=index,
                    poe_id=point.poe_id,
                    planned_stop_minutes=point.planned_stop_minutes,
                )
                for index, point in enumerate(point_models, start=1)
            ]
            await self.repository.replace_route_points(route.id, points)

        return await self.get_route(route_id=route.id, user_id=user_id)

    async def delete_route(
        self,
        *,
        route_id: str,
        user_id: uuid.UUID,
    ) -> None:
        route = await self._get_user_route(route_id=route_id, user_id=user_id)
        await self.repository.delete(route)

    async def _get_user_route(self, route_id: str, user_id: uuid.UUID) -> Route:
        route = await self.repository.get_by_id(route_id)
        if route is None:
            raise HTTPException(status_code=404, detail="Route not found")
        if route.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access route")
        return route

    def _journey_public(self, route: Route) -> RouteJourneyPublic:
        return RouteJourneyPublic(
            id=route.id,
            status=route.status,
            progress_order=route.progress_order,
            started_at=route.started_at,
            completed_at=route.completed_at,
        )

    def _select_points(self, request: RouteGenerateRequest, candidates: list[Poe]) -> list[Poe]:
        candidates = [
            poe
            for poe in candidates
            if self._matches_accessibility_request(poe, request.accessibility)
        ]
        interests = {interest.lower() for interest in request.interests}
        matching = [
            poe
            for poe in candidates
            if not interests
            or poe.category.lower() in interests
            or interests.intersection({tag.lower() for tag in poe.tags})
        ]
        pool = matching or candidates
        current_lat = request.start_location.lat
        current_lng = request.start_location.lng
        selected: list[Poe] = []
        spent_minutes = 0
        speed = PACE_WALKING_SPEED_METERS_PER_MINUTE[request.pace]

        while pool:
            next_poe = min(
                pool,
                key=lambda poe: distance_meters(current_lat, current_lng, poe.lat, poe.lng),
            )
            travel_minutes = distance_meters(
                current_lat,
                current_lng,
                next_poe.lat,
                next_poe.lng,
            ) / speed
            planned_minutes = round(travel_minutes + next_poe.duration_minutes)
            if selected and spent_minutes + planned_minutes > request.duration_minutes:
                break
            selected.append(next_poe)
            spent_minutes += min(planned_minutes, request.duration_minutes - spent_minutes)
            current_lat = next_poe.lat
            current_lng = next_poe.lng
            pool.remove(next_poe)
            if spent_minutes >= request.duration_minutes:
                break
        return selected

    def _matches_accessibility_request(
        self,
        poe: Poe,
        accessibility: RouteAccessibilityRequest,
    ) -> bool:
        if accessibility.wheelchair_required and not poe.wheelchair_accessible:
            return False
        if accessibility.requires_ramp and not poe.has_ramp:
            return False
        if accessibility.avoid_stairs and poe.has_stairs:
            return False
        if accessibility.audio_preferred and self._is_noisy_poe(poe):
            return False
        return True

    def _is_noisy_poe(self, poe: Poe) -> bool:
        text = " ".join(
            [
                poe.title,
                poe.description,
                poe.category,
                *[str(tag) for tag in poe.tags],
            ],
        ).lower()
        return any(marker in text for marker in NOISY_POE_MARKERS)

    def _route_distance(self, request: RouteGenerateRequest, points: list[Poe]) -> int:
        total = 0
        current_lat = request.start_location.lat
        current_lng = request.start_location.lng
        for point in points:
            total += distance_meters(current_lat, current_lng, point.lat, point.lng)
            current_lat = point.lat
            current_lng = point.lng
        return total

    def _accessibility_score(self, points: list[Poe]) -> int:
        if not points:
            return 0
        point_scores = [
            100 if poe.wheelchair_accessible and not poe.has_stairs else 70 if poe.has_ramp else 40
            for poe in points
        ]
        return round(sum(point_scores) / len(point_scores))

    def _build_title(self, request: RouteGenerateRequest, points: list[Poe]) -> str:
        if request.interests:
            return "Маршрут: " + " + ".join(request.interests[:2])
        if points:
            return f"Маршрут: {points[0].category}"
        return "Новый маршрут"

    async def get_scenarios(self) -> RouteScenariosPublic:
        items = await self.repository.list_active_scenarios()
        return RouteScenariosPublic(
            data=[
                RouteScenarioPublic(
                    id=item.id,
                    slug=item.slug,
                    title=item.title,
                    description=item.description,
                    icon=item.icon,
                    interests=list(item.interests or []),
                    duration_minutes=item.duration_minutes,
                    pace=Pace(item.pace),
                    budget_level=item.budget_level,
                    accessibility=RouteAccessibilityRequest(
                        wheelchair_required=item.wheelchair_required,
                        avoid_stairs=item.avoid_stairs,
                        need_rest_points=item.need_rest_points,
                    ),
                    sort_order=item.sort_order,
                )
                for item in items
            ],
            meta=PaginationMeta.create(page=1, limit=len(items) or 1, total=len(items)),
        )
