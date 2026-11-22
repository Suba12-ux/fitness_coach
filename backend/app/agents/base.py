"""Базовый интерфейс субагента."""

from abc import ABC, abstractmethod

from app.schemas.results import AgentResult
from app.schemas.tasks import AgentTask


class BaseAgent(ABC):
    """Общий контракт: каждый агент принимает задачу и возвращает результат."""

    @abstractmethod
    def run(self, task: AgentTask) -> AgentResult:
        """Выполнить задачу и вернуть структурированный результат."""
        raise NotImplementedError
