"""Training Agent: строит черновик тренировочного плана.

Детерминированная тестовая реализация без LLM. Возвращает план в согласованной
структуре и помечает assumptions/limitations.
"""

from typing import Any, Dict, List

from app.agents.base import BaseAgent
from app.schemas.results import (
    AgentResult,
    AgentStatus,
    TrainingExercise,
    TrainingPlan,
    TrainingSession,
    UserProfile,
)
from app.schemas.tasks import AgentTask

_STRENGTH_PRESCRIPTION = {
    "низкая": (3, 10),
    "средняя": (3, 12),
    "высокая": (4, 10),
}

_INTERVALS_BY_INTENSITY = {"низкая": 4, "средняя": 6, "высокая": 8}


class TrainingAgent(BaseAgent):
    """Формирует черновик плана на основе нормализованного профиля."""

    def run(self, task: AgentTask) -> AgentResult:
        profile = UserProfile.model_validate(task.input.get("profile", {}))
        plan = self._build_plan(profile)

        return AgentResult(
            task_id=task.id,
            status=AgentStatus.SUCCESS,
            data=plan.model_dump(),
            warnings=self._build_warnings(profile),
        )

    def _build_plan(self, profile: UserProfile) -> TrainingPlan:
        assumptions: List[str] = []
        limitations: List[str] = list(profile.limitations)

        duration = profile.minutes_per_session or 45
        if profile.minutes_per_session is None:
            assumptions.append("Длительность занятия принята равной 45 минутам.")
        if profile.age is None:
            assumptions.append("Возраст не указан — интенсивность выбрана по умолчанию.")

        days = max(1, profile.days_per_week or 3)
        if profile.days_per_week is None:
            assumptions.append("Количество дней в неделю принято равным 3.")

        intensity = self._intensity(profile)
        sessions = self._make_sessions(days, duration, intensity, limitations)

        return TrainingPlan(
            goal=profile.goal or "общая физическая форма",
            sessions=sessions,
            assumptions=assumptions,
            limitations=limitations,
        )

    @staticmethod
    def _intensity(profile: UserProfile) -> str:
        level = profile.experience_level
        if level == "beginner":
            return "низкая"
        if level == "advanced":
            return "высокая"
        return "средняя"

    def _make_sessions(
        self,
        days: int,
        duration: int,
        intensity: str,
        limitations: List[str],
    ) -> List[TrainingSession]:
        names = ["Понедельник", "Среда", "Пятница", "Вторник", "Четверг"]
        kinds = ("strength", "cardio", "functional")
        sessions: List[TrainingSession] = []
        for index in range(days):
            day = names[index % len(names)]
            kind = kinds[index % len(kinds)]
            sessions.append(
                TrainingSession(
                    day=day,
                    activity=self._pick_activity(index, intensity, limitations),
                    duration_min=duration,
                    exercises=self._build_exercises(
                        kind, intensity, limitations
                    ),
                )
            )
        return sessions

    @staticmethod
    def _pick_activity(index: int, intensity: str, limitations: List[str]) -> str:
        base = [
            ("Силовая тренировка", "средняя"),
            ("Кардио-тренировка", "низкая"),
            ("Функциональная тренировка", "средняя"),
        ]
        name, default_intensity = base[index % len(base)]
        chosen = default_intensity if intensity == "средняя" else intensity
        activity = f"{name} ({chosen} интенсивность)"
        if limitations:
            activity += " (адаптировано под ограничения)"
        return activity

    @staticmethod
    def _build_exercises(
        kind: str, intensity: str, limitations: List[str]
    ) -> List[TrainingExercise]:
        """Детерминированный набор упражнений без выдуманных рабочих весов."""
        note = "Адаптировано под ограничения" if limitations else None
        sets, reps = _STRENGTH_PRESCRIPTION.get(intensity, (3, 12))

        if kind == "strength":
            return [
                TrainingExercise(
                    name="Приседания", sets=sets, reps=reps, notes=note
                ),
                TrainingExercise(
                    name="Жим лёжа", sets=sets, reps=reps, notes=note
                ),
                TrainingExercise(
                    name="Тяга в наклоне", sets=sets, reps=reps, notes=note
                ),
                TrainingExercise(
                    name="Планка",
                    sets=sets,
                    duration_min=1,
                    notes=note,
                ),
            ]

        if kind == "cardio":
            intervals = _INTERVALS_BY_INTENSITY.get(intensity, 6)
            return [
                TrainingExercise(name="Разминка", duration_min=10, notes=note),
                TrainingExercise(
                    name="Интервалы",
                    sets=intervals,
                    duration_min=1,
                    notes=note,
                ),
                TrainingExercise(name="Заминка", duration_min=5, notes=note),
            ]

        return [
            TrainingExercise(
                name="Приседания с собственным весом",
                sets=sets,
                reps=reps,
                notes=note,
            ),
            TrainingExercise(
                name="Отжимания от пола", sets=sets, reps=reps, notes=note
            ),
            TrainingExercise(
                name="Выпады", sets=sets, reps=reps, notes=note
            ),
        ]

    @staticmethod
    def _build_warnings(profile: UserProfile) -> List[str]:
        warnings: List[str] = []
        if not profile.limitations:
            warnings.append("Ограничения по здоровью не указаны — проконсультируйтесь со специалистом.")
        return warnings
