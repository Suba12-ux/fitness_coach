"""Схемы нормализованной программы и HTTP-контракты программ."""

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProgramStatus = Literal["active", "archived"]


class ProgramExerciseContent(BaseModel):
    """Упражнение внутри сохранённой программы."""

    name: str
    position: int
    planned: Dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None


class ProgramWorkoutContent(BaseModel):
    """Запланированная тренировка программы."""

    position: int
    day: Optional[str] = None
    title: str
    description: Optional[str] = None
    duration_min: Optional[int] = None
    exercises: List[ProgramExerciseContent] = Field(default_factory=list)


class ProgramContent(BaseModel):
    """Каноническое содержимое программы, независимое от ответа агента."""

    goal: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    workouts: List[ProgramWorkoutContent] = Field(default_factory=list)


class ProgramCreateRequest(BaseModel):
    """Сохранить программу из завершённого запуска."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    activate: bool = True


class ProgramUpdateRequest(BaseModel):
    """Изменить название, описание или статус программы."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[ProgramStatus] = None

    @model_validator(mode="after")
    def _require_change(self) -> "ProgramUpdateRequest":
        if all(
            value is None
            for value in (self.name, self.description, self.status)
        ):
            raise ValueError("Нужно указать хотя бы одно изменение.")
        return self


class PlannedWorkoutView(BaseModel):
    """Запланированная тренировка вместе с состоянием выполнения."""

    id: str
    position: int
    day: Optional[str] = None
    title: str
    description: Optional[str] = None
    duration_min: Optional[int] = None
    scheduled_date: Optional[date] = None
    exercises: List[ProgramExerciseContent] = Field(default_factory=list)
    completed_sessions_count: int = 0
    last_completed_at: Optional[datetime] = None
    in_progress_session_id: Optional[str] = None


class ProgramSummary(BaseModel):
    """Краткая карточка программы."""

    id: str
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    status: str
    source_run_id: Optional[str] = None
    planned_workouts_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProgramList(BaseModel):
    """Страница списка программ."""

    items: List[ProgramSummary] = Field(default_factory=list)
    total: int = 0


class ProgramDetail(ProgramSummary):
    """Программа с запланированными тренировками."""

    assumptions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    workouts: List[PlannedWorkoutView] = Field(default_factory=list)
