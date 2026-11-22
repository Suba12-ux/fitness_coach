"""Структуры задач, передаваемых агентам."""

from enum import Enum
from typing import Any, Dict

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """Доступные типы подзадач."""

    PROFILE = "profile"
    TRAINING = "training"
    SAFETY = "safety"


class AgentTask(BaseModel):
    """Задача для субагента в структурированном виде."""

    id: str
    type: TaskType
    input: Dict[str, Any]
    constraints: Dict[str, Any] = Field(default_factory=dict)
