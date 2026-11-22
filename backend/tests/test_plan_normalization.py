"""Проверки расширенного формата плана и нормализации в программу."""

import pytest

from app.agents.supervisor import Supervisor
from app.agents.training_agent import TrainingAgent
from app.schemas.results import (
    TrainingExercise,
    TrainingPlan,
    TrainingSession,
    UserProfile,
)
from app.schemas.tasks import AgentTask, TaskType
from app.services.programs import normalize_plan


def _profile() -> UserProfile:
    return UserProfile(
        goal="общая физическая форма",
        experience_level="beginner",
        days_per_week=3,
        minutes_per_session=45,
    )


def test_training_agent_adds_exercises_without_inventing_weights() -> None:
    result = TrainingAgent().run(
        AgentTask(
            id="training",
            type=TaskType.TRAINING,
            input={"profile": _profile().model_dump()},
        )
    )

    plan = TrainingPlan.model_validate(result.data)
    assert len(plan.sessions) == 3
    assert all(session.exercises for session in plan.sessions)
    names = [ex.name for session in plan.sessions for ex in session.exercises]
    assert "Приседания" in names
    assert all(
        exercise.weight_kg is None
        for session in plan.sessions
        for exercise in session.exercises
    )


def test_training_agent_marks_limitation_note() -> None:
    profile = _profile()
    profile.limitations = ["колено"]

    result = TrainingAgent().run(
        AgentTask(
            id="training",
            type=TaskType.TRAINING,
            input={"profile": profile.model_dump()},
        )
    )

    plan = TrainingPlan.model_validate(result.data)
    assert plan.sessions[0].exercises[0].notes == "Адаптировано под ограничения"


def test_normalize_plan_copies_exercises_and_planned_values() -> None:
    plan = TrainingPlan(
        goal="сила",
        sessions=[
            TrainingSession(
                day="Понедельник",
                activity="Силовая тренировка",
                duration_min=45,
                exercises=[
                    TrainingExercise(name="Приседания", sets=3, reps=10)
                ],
            )
        ],
    )

    content = normalize_plan(plan)

    assert content.goal == "сила"
    assert len(content.workouts) == 1
    workout = content.workouts[0]
    assert workout.position == 1
    assert workout.title == "Силовая тренировка"
    assert workout.day == "Понедельник"
    assert workout.exercises[0].planned == {"sets": 3, "reps": 10}
    assert "weight_kg" not in workout.exercises[0].planned


def test_normalize_legacy_plan_without_exercises() -> None:
    legacy = {
        "goal": "выносливость",
        "sessions": [
            {"day": "Среда", "activity": "Кардио-тренировка", "duration_min": 30}
        ],
    }

    content = normalize_plan(TrainingPlan.model_validate(legacy))

    assert len(content.workouts) == 1
    assert content.workouts[0].exercises == []
    assert content.workouts[0].duration_min == 30


def test_supervisor_rejects_exercise_without_name() -> None:
    data = {
        "goal": "цель",
        "sessions": [
            {
                "day": "Пн",
                "activity": "бег",
                "duration_min": 30,
                "exercises": [{"name": "  ", "sets": 3}],
            }
        ],
    }

    with pytest.raises(ValueError, match="название"):
        Supervisor._validate_training_plan(data)


def test_supervisor_rejects_non_positive_exercise_values() -> None:
    data = {
        "goal": "цель",
        "sessions": [
            {
                "day": "Пн",
                "activity": "бег",
                "duration_min": 30,
                "exercises": [{"name": "Приседания", "reps": 0}],
            }
        ],
    }

    with pytest.raises(ValueError, match="повторения"):
        Supervisor._validate_training_plan(data)
