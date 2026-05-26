import datetime


APP_TIMEZONE = datetime.timezone(datetime.timedelta(hours=5))


def app_now() -> datetime.datetime:
    return datetime.datetime.now(APP_TIMEZONE).replace(tzinfo=None)


def normalize_app_datetime(value: datetime.datetime) -> datetime.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=None)
    return value.astimezone(APP_TIMEZONE).replace(tzinfo=None)
