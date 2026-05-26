import datetime

from fastapi import APIRouter, Response

from src.app.api.dependencies.common import NotificationServiceDep, RouteServiceDep
from src.app.api.dependencies.pagination import PaginationDep
from src.app.api.dependencies.users import CurrentUser
from src.app.db.models.route import (
    RouteGenerateRequest,
    RouteGenerateResponse,
    RouteJourneyResponse,
    RouteManualUpdate,
    RouteProgressUpdate,
    RouteResponse,
    RouteSaveResponse,
    RouteScenariosPublic,
    RouteSource,
    RoutesPublic,
    RouteStatus,
)

router = APIRouter()


@router.get("", response_model=RoutesPublic)
@router.get("/", response_model=RoutesPublic, include_in_schema=False)
async def read_routes(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    pagination: PaginationDep,
    status: RouteStatus | None = None,
    source: RouteSource | None = None,
) -> RoutesPublic:
    return await route_service.get_routes(
        user_id=current_user.id,
        page=pagination.page,
        limit=pagination.limit,
        status=status,
        source=source,
    )


@router.get("/history", response_model=RoutesPublic)
async def read_route_history(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    pagination: PaginationDep,
    status: RouteStatus | None = None,
    source: RouteSource | None = None,
    date_from: datetime.datetime | None = None,
    date_to: datetime.datetime | None = None,
) -> RoutesPublic:
    return await route_service.get_route_history(
        user_id=current_user.id,
        page=pagination.page,
        limit=pagination.limit,
        status=status,
        source=source,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/generate", response_model=RouteGenerateResponse, status_code=201)
async def generate_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_in: RouteGenerateRequest,
) -> RouteGenerateResponse:
    return await route_service.generate_route(route_in, user_id=current_user.id)


@router.get("/scenarios", response_model=RouteScenariosPublic)
async def read_route_scenarios(
    route_service: RouteServiceDep,
) -> RouteScenariosPublic:
    """Список «быстрых сценариев» для главного экрана.

    Публичный эндпоинт: возвращает активные пресеты, отсортированные по `sort_order`.
    Каждый пресет — параметры для последующего вызова `POST /routes/generate`.
    """
    return await route_service.get_scenarios()


@router.get("/{route_id}", response_model=RouteResponse)
async def read_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
) -> RouteResponse:
    return await route_service.get_route(route_id=route_id, user_id=current_user.id)


@router.post("/{route_id}/save", response_model=RouteSaveResponse)
async def save_route(
    route_service: RouteServiceDep,
    notification_service: NotificationServiceDep,
    current_user: CurrentUser,
    route_id: str,
) -> RouteSaveResponse:
    response = await route_service.save_route(route_id=route_id, user_id=current_user.id)
    await notification_service.create_event(
        user_id=current_user.id,
        event_type="route_ready",
        title="Маршрут готов",
        payload=route_id,
    )
    return response


@router.delete("/{route_id}", status_code=204)
async def delete_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
) -> Response:
    await route_service.delete_route(route_id=route_id, user_id=current_user.id)
    return Response(status_code=204)


@router.post("/{route_id}/start", response_model=RouteJourneyResponse)
async def start_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
) -> RouteJourneyResponse:
    return await route_service.start_route(route_id=route_id, user_id=current_user.id)


@router.post("/{route_id}/progress", response_model=RouteJourneyResponse)
async def progress_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
    progress_in: RouteProgressUpdate,
) -> RouteJourneyResponse:
    return await route_service.progress_route(
        route_id=route_id,
        user_id=current_user.id,
        progress_in=progress_in,
    )


@router.post("/{route_id}/finish", response_model=RouteJourneyResponse)
async def finish_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
) -> RouteJourneyResponse:
    return await route_service.finish_route(route_id=route_id, user_id=current_user.id)


@router.patch("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_service: RouteServiceDep,
    current_user: CurrentUser,
    route_id: str,
    route_in: RouteManualUpdate,
) -> RouteResponse:
    return await route_service.update_route(
        route_id=route_id,
        user_id=current_user.id,
        route_in=route_in,
    )
