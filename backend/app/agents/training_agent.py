"""Training Agent: строит черновик тренировочного плана.

Детерминированная тестовая реализация без LLM. Возвращает план в согласованной
структуре и помечает assumptions/limitations.
"""

from typing import Any, Dict, List

from app.agents.base import BaseAgent
from app.schemas.results import (
    AgentResult,
    AgentStatus,
    TrainingPlan,
    TrainingSession,
    UserProfile,
)
from app.schemas.tasks import AgentTask


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
        sessions: List[TrainingSession] = []
        for index in range(days):
            day = names[index % len(names)]
            activity = self._pick_activity(index, intensity, limitations)
            sessions.append(
                TrainingSession(day=day, activity=activity, duration_min=duration)
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
    def _build_warnings(profile: UserProfile) -> List[str]:
        warnings: List[str] = []
        if not profile.limitations:
            warnings.append("Ограничения по здоровью не указаны — проконсультируйтесь со специалистом.")
        return warnings
