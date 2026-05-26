from collections.abc import Sequence

from sqlalchemy import func, select

from src.app.db.models.poe import Poe, PoeTaxonomy
from src.app.repositories.base import BaseRepository


class PoeRepository(BaseRepository[Poe]):
    model = Poe

    async def list_candidates(
        self,
        *,
        city_id: str | None = None,
        category: str | None = None,
        wheelchair_accessible: bool | None = None,
        requires_ramp: bool | None = None,
        avoid_stairs: bool | None = None,
    ) -> Sequence[Poe]:
        statement = select(Poe)
        if city_id:
            statement = statement.where(Poe.city_id == city_id)
        if category:
            statement = statement.where(Poe.category == category)
        if wheelchair_accessible is not None:
            statement = statement.where(Poe.wheelchair_accessible == wheelchair_accessible)
        if requires_ramp:
            statement = statement.where(Poe.has_ramp.is_(True))
        if avoid_stairs:
            statement = statement.where(Poe.has_stairs.is_(False))
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def get_by_ids(self, ids: list[str]) -> dict[str, Poe]:
        if not ids:
            return {}
        statement = select(Poe).where(Poe.id.in_(ids))
        result = await self.session.execute(statement)
        rows = result.scalars().all()
        return {poe.id: poe for poe in rows}

    async def list_admin_poes(
        self,
        skip: int,
        limit: int,
        status: str | None = None,
    ) -> tuple[Sequence[Poe], int]:
        statement = select(Poe)
        total_statement = select(func.count()).select_from(Poe)
        if status is not None:
            statement = statement.where(Poe.status == status)
            total_statement = total_statement.where(Poe.status == status)
        statement = statement.order_by(Poe.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total

    async def list_taxonomies(
        self,
        skip: int,
        limit: int,
        type_value: str | None = None,
        status: str | None = None,
    ) -> tuple[Sequence[PoeTaxonomy], int]:
        statement = select(PoeTaxonomy)
        total_statement = select(func.count()).select_from(PoeTaxonomy)
        if type_value is not None:
            statement = statement.where(PoeTaxonomy.type == type_value)
            total_statement = total_statement.where(PoeTaxonomy.type == type_value)
        if status is not None:
            statement = statement.where(PoeTaxonomy.status == status)
            total_statement = total_statement.where(PoeTaxonomy.status == status)
        statement = statement.order_by(PoeTaxonomy.created_at.desc()).offset(skip).limit(limit)
        items = (await self.session.execute(statement)).scalars().all()
        total = int((await self.session.execute(total_statement)).scalar_one())
        return items, total

    async def get_taxonomy_by_type_and_value(
        self,
        type_value: str,
        value: str,
    ) -> PoeTaxonomy | None:
        statement = select(PoeTaxonomy).where(
            PoeTaxonomy.type == type_value,
            PoeTaxonomy.value == value,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def get_taxonomy(self, taxonomy_id: str) -> PoeTaxonomy | None:
        return await self.session.get(PoeTaxonomy, taxonomy_id)
