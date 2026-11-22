"""Результаты агентов и общее состояние процесса."""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.tasks import AgentTask

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]


class AgentStatus(str, Enum):
    """Статус выполнения подзадачи."""

    SUCCESS = "success"
    NEEDS_INFO = "needs_info"
    ERROR = "error"


class UserProfile(BaseModel):
    """Нормализованный профиль пользователя."""

    goal: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    experience_level: Optional[ExperienceLevel] = None
    days_per_week: Optional[int] = None
    minutes_per_session: Optional[int] = None
    limitations: List[str] = Field(default_factory=list)


class TrainingSession(BaseModel):
    """Одна тренировка в недельном плане."""

    day: str
    activity: str
    duration_min: int


class TrainingPlan(BaseModel):
    """Черновик тренировочного плана."""

    goal: str
    sessions: List[TrainingSession]
    assumptions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class AgentResult(BaseModel):
    """Структурированный результат субагента."""

    task_id: str
    status: AgentStatus
    data: Optional[Dict[str, Any]] = None
    missing_data: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class SafetyIssue(BaseModel):
    """Одно замечание проверки безопасности."""

    severity: Literal["info", "warning", "error"]
    message: str


class SafetyReport(BaseModel):
    """Результат программной проверки безопасности."""

    issues: List[SafetyIssue] = Field(default_factory=list)


class PlanStatus(str, Enum):
    """Статус всего процесса."""

    PENDING = "pending"
    RUNNING = "running"
    NEEDS_INFO = "needs_info"
    DONE = "done"
    ERROR = "error"


class PlanState(BaseModel):
    """Состояние процесса от запроса до итогового ответа."""

    request: str
    profile: Optional[UserProfile] = None
    tasks: List[AgentTask] = Field(default_factory=list)
    results: Dict[str, AgentResult] = Field(default_factory=dict)
    status: PlanStatus = PlanStatus.PENDING
    final_answer: Optional[Dict[str, Any]] = None
