from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Literal, Optional, Set, Tuple
from zoneinfo import ZoneInfo

SessionStatus = Literal["past", "active", "upcoming"]

#: Hard ceiling on how many dated occurrences a single lecture can expose.
MAX_SESSIONS = 500
#: Used when a lecture has no recorded start_date.
DEFAULT_LOOKBACK_WEEKS = 52
#: Oldest origin accepted, so a stray start_date cannot expand the range forever.
MAX_LOOKBACK_WEEKS = 260
#: How far past today the timeline keeps generating upcoming sessions.
LOOKAHEAD_WEEKS = 26


def now_in_timezone(timezone_name: str) -> datetime:
    return datetime.now(ZoneInfo(timezone_name))


def parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _clock(value: str) -> time:
    return time.fromisoformat(value)


def attendance_window_state(
    schedules: List[Dict[str, Any]], now: datetime
) -> Tuple[bool, bool]:
    """Return (matching_day_found, window_open) for the given instant."""
    current_day = now.strftime("%A").lower()
    current_time = now.timetz().replace(tzinfo=None)
    matching_day_found = False

    for schedule in schedules:
        if schedule["day_of_week"].lower() != current_day:
            continue
        matching_day_found = True
        start_t = _clock(schedule["attendance_start_time"])
        end_t = _clock(schedule["attendance_end_time"])
        if start_t <= current_time <= end_t:
            return True, True

    return matching_day_found, False


def is_lecture_active(schedules: List[Dict[str, Any]], now: datetime) -> bool:
    """True when now falls in the attendance window or the lecture period."""
    _, window_open = attendance_window_state(schedules, now)
    if window_open:
        return True

    current_day = now.strftime("%A").lower()
    current_time = now.timetz().replace(tzinfo=None)
    for schedule in schedules:
        if schedule["day_of_week"].lower() != current_day:
            continue
        start_t = _clock(schedule["lecture_start_time"])
        end_t = _clock(schedule["lecture_end_time"])
        if start_t <= current_time <= end_t:
            return True
    return False


def _schedules_for_day(
    schedules: List[Dict[str, Any]], day_name: str
) -> List[Dict[str, Any]]:
    target = day_name.lower()
    return [item for item in schedules if item["day_of_week"].lower() == target]


def _session_payload(
    session_date: date,
    slots: List[Dict[str, Any]],
    index: int,
    timezone_name: str,
) -> Dict[str, Any]:
    first = slots[0]
    lecture_start = min(item["lecture_start_time"] for item in slots)
    lecture_end = max(item["lecture_end_time"] for item in slots)
    attendance_start = min(item["attendance_start_time"] for item in slots)
    attendance_end = max(item["attendance_end_time"] for item in slots)
    tz = ZoneInfo(timezone_name)
    ends_at = datetime.combine(session_date, _clock(lecture_end), tzinfo=tz)
    return {
        "date": session_date.isoformat(),
        "day_of_week": first["day_of_week"],
        "session_index": index,
        "lecture_start_time": lecture_start,
        "lecture_end_time": lecture_end,
        "attendance_start_time": attendance_start,
        "attendance_end_time": attendance_end,
        "ends_at": ends_at,
    }


def resolve_timeline_origin(
    today: date, start_date: Optional[str] = None
) -> date:
    """First date the timeline may cover: the lecture start, clamped to a sane past."""
    earliest = today - timedelta(weeks=MAX_LOOKBACK_WEEKS)
    parsed = parse_iso_date(start_date)
    if parsed is None:
        return today - timedelta(weeks=DEFAULT_LOOKBACK_WEEKS)
    return max(parsed, earliest)


def build_lecture_sessions(
    schedules: List[Dict[str, Any]],
    now: datetime,
    extra_dates: Optional[List[str]] = None,
    timezone_name: str = "Asia/Riyadh",
    start_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Expand weekly schedules into dated sessions from the lecture start onward.

    Session numbering is anchored to the origin, so "session 1" stays the first
    lecture of the term even when the list is trimmed to `MAX_SESSIONS`.
    """
    today = now.date()
    origin = resolve_timeline_origin(today, start_date)
    horizon = max(today, origin) + timedelta(weeks=LOOKAHEAD_WEEKS)
    dates: Set[date] = set()

    cursor = origin
    while cursor <= horizon:
        if _schedules_for_day(schedules, cursor.strftime("%A")):
            dates.add(cursor)
        cursor += timedelta(days=1)

    # Dates that already hold attendance stay reachable even outside the range.
    for raw in extra_dates or []:
        parsed = parse_iso_date(raw)
        if parsed is not None:
            dates.add(parsed)

    sessions: List[Dict[str, Any]] = []
    for index, session_date in enumerate(sorted(dates), start=1):
        slots = _schedules_for_day(schedules, session_date.strftime("%A"))
        if not slots:
            slots = [
                {
                    "day_of_week": session_date.strftime("%A"),
                    "lecture_start_time": "00:00",
                    "lecture_end_time": "23:59",
                    "attendance_start_time": "00:00",
                    "attendance_end_time": "23:59",
                }
            ]
        sessions.append(_session_payload(session_date, slots, index, timezone_name))

    return sessions[-MAX_SESSIONS:]


def pick_default_session_date(
    sessions: List[Dict[str, Any]],
    schedules: List[Dict[str, Any]],
    now: datetime,
) -> Optional[str]:
    if not sessions:
        return None

    today = now.date().isoformat()
    dates = [item["date"] for item in sessions]

    if is_lecture_active(schedules, now) and today in dates:
        return today

    past = [item for item in sessions if item["ends_at"] <= now]
    if past:
        return past[-1]["date"]
    return sessions[0]["date"]


def academic_week_bounds(now: datetime) -> Tuple[date, date]:
    """Sunday 00:00 through Saturday 23:59 in the datetime's calendar."""
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = now.date() - timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def iso_weekday(value: date) -> int:
    """Monday = 0 … Sunday = 6 (Python/ISO weekday)."""
    return value.weekday()


def session_runtime_status(session: Dict[str, Any], now: datetime) -> SessionStatus:
    """Classify a dated session as past, active, or upcoming in `now`'s timezone."""
    if session["ends_at"] <= now:
        return "past"

    session_date = date.fromisoformat(session["date"])
    if now.date() != session_date:
        return "upcoming"

    current_time = now.timetz().replace(tzinfo=None)
    lecture_start = _clock(session["lecture_start_time"])
    lecture_end = _clock(session["lecture_end_time"])
    attendance_start = _clock(session["attendance_start_time"])
    attendance_end = _clock(session["attendance_end_time"])
    in_lecture = lecture_start <= current_time <= lecture_end
    in_window = attendance_start <= current_time <= attendance_end
    if in_lecture or in_window:
        return "active"
    return "upcoming"


def pick_student_status_session(
    sessions: List[Dict[str, Any]],
    schedules: List[Dict[str, Any]],
    now: datetime,
    today_is_present: bool = False,
) -> Optional[Dict[str, Any]]:
    """Choose the session whose attendance the student portal should report.

    Today wins while its window or lecture is live, after it has ended, or when
    the student already has a record for today. Otherwise the latest completed
    session (`lecture_end_time <= now`) is used; if none exist yet, the earliest
    upcoming session.
    """
    if not sessions:
        return None

    today = now.date().isoformat()
    today_session = next((item for item in sessions if item["date"] == today), None)

    if today_session:
        if is_lecture_active(schedules, now):
            return today_session
        if today_session["ends_at"] <= now:
            return today_session
        if today_is_present:
            return today_session

    past = [item for item in sessions if item["ends_at"] <= now]
    if past:
        return past[-1]
    return sessions[0]


def public_session_fields(session: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in session.items() if key != "ends_at"}
