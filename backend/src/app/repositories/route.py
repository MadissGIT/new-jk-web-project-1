from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select

from src.app.db.models.route import Route, RoutePoint, RouteScenario, RouteSource, RouteStatus
from src.app.repositories.base import BaseRepository


class RouteRepository(BaseRepository[Route]):
    model = Route

    async def create_with_points(self, route: Route, points: list[RoutePoint]) -> Route:
        self.session.add(route)
        self.session.add_all(points)
        await self.session.commit()
        await self.session.refresh(route)
        return route

    async def list_user_routes(
        self,
        user_id: UUID,
        skip: int,
        limit: int,
        status: RouteStatus | None = None,
        source: RouteSource | None = None,
        date_from: object | None = None,
        date_to: object | None = None,
    ) -> tuple[Sequence[Route], int]:
        statement = select(Route).where(Route.user_id == user_id)
        if status is not None:
            statement = statement.where(Route.status == status)
        if source is not None:
            statement = statement.where(Route.source == source)
        if date_from is not None:
            statement = statement.where(Route.created_at >= date_from)
        if date_to is not None:
            statement = statement.where(Route.created_at <= date_to)
        statement = statement.order_by(Route.created_at.desc())
        items = (await self.session.execute(statement.offset(skip).limit(limit))).scalars().all()

        total_statement = select(func.count()).select_from(Route).where(Route.user_id == user_id)
        if status is not None:
            total_statement = total_statement.where(Route.status == status)
        if source is not None:
            total_statement = total_statement.where(Route.source == source)
        if date_from is not None:
            total_statement = total_statement.where(Route.created_at >= date_from)
        if date_to is not None:
            total_statement = total_statement.where(Route.created_at <= date_to)
        total = (await self.session.execute(total_statement)).scalar_one()
        return items, total

    async def get_route_points(self, route_id: str) -> Sequence[RoutePoint]:
        statement = (
            select(RoutePoint)
            .where(RoutePoint.route_id == route_id)
            .order_by(RoutePoint.order)
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def save_route(self, route: Route) -> Route:
        self.session.add(route)
        await self.session.commit()
        await self.session.refresh(route)
        return route

    async def replace_route_points(self, route_id: str, points: list[RoutePoint]) -> None:
        await self.session.execute(delete(RoutePoint).where(RoutePoint.route_id == route_id))
        self.session.add_all(points)
        await self.session.commit()

    async def list_active_scenarios(self) -> Sequence[RouteScenario]:
        statement = (
            select(RouteScenario)
            .where(RouteScenario.is_active.is_(True))
            .order_by(RouteScenario.sort_order, RouteScenario.created_at)
        )
        return (await self.session.execute(statement)).scalars().all()

    async def get_scenario_by_slug(self, slug: str) -> RouteScenario | None:
        statement = select(RouteScenario).where(RouteScenario.slug == slug)
        return (await self.session.execute(statement)).scalar_one_or_none()
