from datetime import datetime
from zoneinfo import ZoneInfo

from app.services import current_week_sessions_for_lecture
from app.timeutil import (
    MAX_SESSIONS,
    academic_week_bounds,
    attendance_window_state,
    build_lecture_sessions,
    iso_weekday,
    pick_default_session_date,
    pick_student_status_session,
    session_runtime_status,
)

TZ = ZoneInfo("Asia/Riyadh")
SUNDAY_SLOT = {
    "day_of_week": "Sunday",
    "lecture_start_time": "11:00",
    "lecture_end_time": "12:30",
    "attendance_start_time": "11:00",
    "attendance_end_time": "12:30",
}


def test_window_open_on_matching_day():
    now = datetime(2026, 9, 2, 8, 10, tzinfo=TZ)
    matching, open_window = attendance_window_state(
        [
            {
                "day_of_week": "Wednesday",
                "attendance_start_time": "08:00",
                "attendance_end_time": "08:15",
            }
        ],
        now,
    )
    assert matching is True
    assert open_window is True


def test_window_closed_outside_hours():
    now = datetime(2026, 9, 2, 9, 0, tzinfo=TZ)
    matching, open_window = attendance_window_state(
        [
            {
                "day_of_week": "Wednesday",
                "attendance_start_time": "08:00",
                "attendance_end_time": "08:15",
            }
        ],
        now,
    )
    assert matching is True
    assert open_window is False


def test_wrong_weekday():
    now = datetime(2026, 9, 2, 8, 10, tzinfo=TZ)
    matching, open_window = attendance_window_state(
        [
            {
                "day_of_week": "Sunday",
                "attendance_start_time": "08:00",
                "attendance_end_time": "08:15",
            }
        ],
        now,
    )
    assert matching is False
    assert open_window is False


def test_default_session_during_active_window():
    now = datetime(2026, 9, 6, 11, 5, tzinfo=TZ)
    sessions = build_lecture_sessions([SUNDAY_SLOT], now, timezone_name="Asia/Riyadh")
    assert pick_default_session_date(sessions, [SUNDAY_SLOT], now) == "2026-09-06"


def test_default_session_outside_lecture_uses_last_past():
    now = datetime(2026, 9, 7, 10, 0, tzinfo=TZ)
    sessions = build_lecture_sessions([SUNDAY_SLOT], now, timezone_name="Asia/Riyadh")
    assert pick_default_session_date(sessions, [SUNDAY_SLOT], now) == "2026-09-06"


def test_default_session_before_today_slot_uses_previous_week():
    now = datetime(2026, 9, 6, 10, 0, tzinfo=TZ)
    sessions = build_lecture_sessions([SUNDAY_SLOT], now, timezone_name="Asia/Riyadh")
    assert pick_default_session_date(sessions, [SUNDAY_SLOT], now) == "2026-08-30"


def test_timeline_starts_at_lecture_start_date():
    now = datetime(2026, 9, 7, 9, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-09-06", timezone_name="Asia/Riyadh"
    )
    assert sessions[0]["date"] == "2026-09-06"
    assert sessions[0]["session_index"] == 1


def test_timeline_covers_whole_term_and_stays_capped():
    now = datetime(2026, 9, 7, 9, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-01-04", timezone_name="Asia/Riyadh"
    )
    dates = [item["date"] for item in sessions]
    assert dates[0] == "2026-01-04"
    assert "2026-09-06" in dates
    assert len(dates) > 30
    assert len(dates) <= MAX_SESSIONS


def test_recorded_attendance_dates_stay_reachable():
    now = datetime(2026, 9, 7, 9, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT],
        now,
        extra_dates=["2026-08-12"],
        start_date="2026-09-06",
        timezone_name="Asia/Riyadh",
    )
    assert "2026-08-12" in [item["date"] for item in sessions]


def test_academic_week_starts_sunday_and_resets_at_midnight():
    thursday = datetime(2026, 9, 3, 15, 0, tzinfo=TZ)
    assert academic_week_bounds(thursday) == (
        datetime(2026, 8, 30).date(),
        datetime(2026, 9, 5).date(),
    )
    saturday_night = datetime(2026, 9, 5, 23, 59, tzinfo=TZ)
    assert academic_week_bounds(saturday_night) == (
        datetime(2026, 8, 30).date(),
        datetime(2026, 9, 5).date(),
    )
    sunday_start = datetime(2026, 9, 6, 0, 0, tzinfo=TZ)
    assert academic_week_bounds(sunday_start) == (
        datetime(2026, 9, 6).date(),
        datetime(2026, 9, 12).date(),
    )


def test_iso_weekday_sunday_is_six():
    assert iso_weekday(datetime(2026, 9, 6).date()) == 6
    assert iso_weekday(datetime(2026, 9, 7).date()) == 0


def test_session_status_past_active_upcoming():
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT],
        datetime(2026, 9, 7, 9, 0, tzinfo=TZ),
        start_date="2026-08-30",
        timezone_name="Asia/Riyadh",
    )
    this_week = next(item for item in sessions if item["date"] == "2026-09-06")
    assert session_runtime_status(this_week, datetime(2026, 9, 6, 10, 0, tzinfo=TZ)) == "upcoming"
    assert session_runtime_status(this_week, datetime(2026, 9, 6, 11, 15, tzinfo=TZ)) == "active"
    assert session_runtime_status(this_week, datetime(2026, 9, 6, 13, 0, tzinfo=TZ)) == "past"


def test_current_week_sessions_include_index_and_status():
    lecture = {
        "start_date": "2026-08-30",
        "schedules": [SUNDAY_SLOT],
    }
    now = datetime(2026, 9, 3, 10, 0, tzinfo=TZ)
    week = current_week_sessions_for_lecture(lecture, now, "Asia/Riyadh")
    assert [item["date"] for item in week] == ["2026-08-30"]
    assert week[0]["session_index"] == 1
    assert week[0]["status"] == "past"
    assert week[0]["day_of_week"] == "Sunday"

    next_week = current_week_sessions_for_lecture(
        lecture, datetime(2026, 9, 6, 11, 10, tzinfo=TZ), "Asia/Riyadh"
    )
    assert [item["date"] for item in next_week] == ["2026-09-06"]
    assert next_week[0]["session_index"] == 2
    assert next_week[0]["status"] == "active"


def test_student_status_uses_today_when_active_or_completed():
    now = datetime(2026, 9, 6, 11, 10, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-08-30", timezone_name="Asia/Riyadh"
    )
    chosen = pick_student_status_session(sessions, [SUNDAY_SLOT], now)
    assert chosen["date"] == "2026-09-06"

    after = datetime(2026, 9, 6, 13, 0, tzinfo=TZ)
    sessions_after = build_lecture_sessions(
        [SUNDAY_SLOT], after, start_date="2026-08-30", timezone_name="Asia/Riyadh"
    )
    chosen_after = pick_student_status_session(sessions_after, [SUNDAY_SLOT], after)
    assert chosen_after["date"] == "2026-09-06"


def test_student_status_falls_back_to_latest_past_when_today_has_no_session():
    now = datetime(2026, 9, 7, 10, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-08-30", timezone_name="Asia/Riyadh"
    )
    chosen = pick_student_status_session(sessions, [SUNDAY_SLOT], now)
    assert chosen["date"] == "2026-09-06"


def test_student_status_before_today_slot_uses_previous_unless_already_present():
    now = datetime(2026, 9, 6, 10, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-08-30", timezone_name="Asia/Riyadh"
    )
    chosen = pick_student_status_session(sessions, [SUNDAY_SLOT], now)
    assert chosen["date"] == "2026-08-30"

    already_in = pick_student_status_session(
        sessions, [SUNDAY_SLOT], now, today_is_present=True
    )
    assert already_in["date"] == "2026-09-06"


def test_student_status_before_any_session_uses_earliest_upcoming():
    now = datetime(2026, 9, 3, 10, 0, tzinfo=TZ)
    sessions = build_lecture_sessions(
        [SUNDAY_SLOT], now, start_date="2026-09-06", timezone_name="Asia/Riyadh"
    )
    chosen = pick_student_status_session(sessions, [SUNDAY_SLOT], now)
    assert chosen["date"] == "2026-09-06"
    assert chosen["session_index"] == 1
