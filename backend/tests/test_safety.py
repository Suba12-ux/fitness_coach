"""Проверки программного SafetyChecker."""

from app.agents.safety_checker import SafetyChecker
from app.schemas.results import AgentStatus, SafetyReport
from app.schemas.tasks import AgentTask, TaskType


def _check(profile: dict) -> SafetyReport:
    task = AgentTask(id="safety", type=TaskType.SAFETY, input={"profile": profile})
    result = SafetyChecker().run(task)
    assert result.status == AgentStatus.SUCCESS
    return SafetyReport.model_validate(result.data)


def _severities(report: SafetyReport):
    return [issue.severity for issue in report.issues]


def test_reasonable_profile_has_no_errors() -> None:
    report = _check(
        {
            "goal": "общая физическая форма",
            "experience_level": "beginner",
            "days_per_week": 3,
            "minutes_per_session": 45,
        }
    )
    assert "error" not in _severities(report)


def test_too_many_days_is_error() -> None:
    report = _check(
        {
            "goal": "общая физическая форма",
            "experience_level": "beginner",
            "days_per_week": 7,
            "minutes_per_session": 45,
        }
    )
    assert "error" in _severities(report)


def test_beginner_with_elite_goal_warns() -> None:
    report = _check(
        {
            "goal": "подготовка к марафону",
            "experience_level": "beginner",
            "days_per_week": 3,
            "minutes_per_session": 45,
        }
    )
    assert "warning" in _severities(report)


def test_long_session_warns() -> None:
    report = _check(
        {
            "goal": "общая физическая форма",
            "experience_level": "intermediate",
            "days_per_week": 3,
            "minutes_per_session": 150,
        }
    )
    assert "warning" in _severities(report)
