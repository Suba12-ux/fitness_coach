"""Profile Agent: нормализует данные пользователя и находит пробелы.

Детерминированная тестовая реализация без LLM: не выдумывает отсутствующие
параметры, а явно перечисляет их в missing_data.
"""

from typing import Any, Dict, List

from app.agents.base import BaseAgent
from app.schemas.results import AgentResult, AgentStatus, UserProfile
from app.schemas.tasks import AgentTask

# Поля, которые считаются обязательными для построения плана.
REQUIRED_FIELDS = (
    "goal",
    "experience_level",
    "days_per_week",
    "minutes_per_session",
)

# Поля, которые допускают None и не считаются ошибкой.
OPTIONAL_FIELDS = ("age", "weight_kg", "height_cm")


class ProfileAgent(BaseAgent):
    """Приводит входные данные к UserProfile и сообщает о пробелах."""

    def run(self, task: AgentTask) -> AgentResult:
        raw: Dict[str, Any] = dict(task.input or {})

        # Берём только известные схеме поля, отбрасывая None, чтобы
        # сохранить значения по умолчанию из схемы (например, limitations=[]).
        profile_data = {
            key: value
            for key, value in raw.items()
            if key in UserProfile.model_fields and value is not None
        }

        missing = self._missing_fields(raw)
        warnings = self._warnings(raw)

        if missing:
            return AgentResult(
                task_id=task.id,
                status=AgentStatus.NEEDS_INFO,
                data=profile_data,
                missing_data=missing,
                warnings=warnings,
            )

        profile = UserProfile.model_validate(profile_data)
        return AgentResult(
            task_id=task.id,
            status=AgentStatus.SUCCESS,
            data=profile.model_dump(),
            warnings=warnings,
        )

    @staticmethod
    def _missing_fields(raw: Dict[str, Any]) -> List[str]:
        missing: List[str] = []
        for field in REQUIRED_FIELDS:
            value = raw.get(field)
            if value is None or value == "":
                missing.append(field)
        return missing

    @staticmethod
    def _warnings(raw: Dict[str, Any]) -> List[str]:
        warnings: List[str] = []
        for field in OPTIONAL_FIELDS:
            if raw.get(field) is None:
                warnings.append(f"Не указано поле '{field}' — будет использовано предположение.")
        for field in raw:
            if field not in UserProfile.model_fields:
                warnings.append(f"Неизвестное поле '{field}' игнорируется.")
        return warnings
