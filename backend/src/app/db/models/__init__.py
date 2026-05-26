from sqlmodel import SQLModel

from src.app.db.models.booking import Booking
from src.app.db.models.favorite import Favorite
from src.app.db.models.guide_application import GuideApplication
from src.app.db.models.guide_profile import GuideProfile
from src.app.db.models.notification import Notification
from src.app.db.models.poe import Poe, PoeTaxonomy
from src.app.db.models.review import Review
from src.app.db.models.route import Route, RoutePoint, RouteScenario
from src.app.db.models.tour import Tour, TourSlot
from src.app.db.models.user import User
from src.app.db.models.user_preference import UserPreferences

__all__ = (
    "Booking",
    "Favorite",
    "GuideApplication",
    "GuideProfile",
    "Notification",
    "Poe",
    "PoeTaxonomy",
    "Review",
    "Route",
    "RoutePoint",
    "RouteScenario",
    "SQLModel",
    "Tour",
    "TourSlot",
    "User",
    "UserPreferences",
)
