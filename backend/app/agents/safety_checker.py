"""SafetyChecker: программные правила проверки безопасности профиля.

Не LLM-агент: критические проверки выполняются обычным кодом.
"""

from typing import List

from app.agents.base import BaseAgent
from app.schemas.results import (
    AgentResult,
    AgentStatus,
    SafetyIssue,
    SafetyReport,
    UserProfile,
)
from app.schemas.tasks import AgentTask

_ELITE_GOAL_HINTS = ("марафон", "триатлон", "рекорд", "соревнов", "кроссфит")


class SafetyChecker(BaseAgent):
    """Проверяет профиль по явным правилам и возвращает SafetyReport."""

    def run(self, task: AgentTask) -> AgentResult:
        profile = UserProfile.model_validate(task.input["profile"])
        issues = self._check(profile)
        report = SafetyReport(issues=issues)
        return AgentResult(
            task_id=task.id,
            status=AgentStatus.SUCCESS,
            data=report.model_dump(),
        )

    @staticmethod
    def _check(profile: UserProfile) -> List[SafetyIssue]:
        issues: List[SafetyIssue] = []

        if profile.days_per_week is not None:
            if profile.days_per_week < 1:
                issues.append(
                    SafetyIssue(
                        severity="error",
                        message="Количество тренировочных дней меньше одного.",
                    )
                )
            elif profile.days_per_week > 6:
                issues.append(
                    SafetyIssue(
                        severity="error",
                        message="Более шести тренировок в неделю без отдыха небезопасно.",
                    )
                )

        if profile.minutes_per_session is not None:
            if profile.minutes_per_session > 120:
                issues.append(
                    SafetyIssue(
                        severity="warning",
                        message="Длительность занятия свыше 120 минут — риск перегрузки.",
                    )
                )
            elif profile.minutes_per_session < 15:
                issues.append(
                    SafetyIssue(
                        severity="warning",
                        message="Длительность занятия менее 15 минут даёт мало эффекта.",
                    )
                )

        goal = (profile.goal or "").lower()
        if profile.experience_level == "beginner" and any(
            hint in goal for hint in _ELITE_GOAL_HINTS
        ):
            issues.append(
                SafetyIssue(
                    severity="warning",
                    message="Амбициозная цель при начальном уровне — нужна постепенность.",
                )
            )

        if profile.limitations:
            issues.append(
                SafetyIssue(
                    severity="info",
                    message="Указаны ограничения — они учтены в плане.",
                )
            )

        return issues
