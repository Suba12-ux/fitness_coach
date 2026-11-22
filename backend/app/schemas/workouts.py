"""Схемы фактических тренировок и их результатов."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WorkoutStatus = Literal["in_progress", "completed", "skipped", "cancelled"]


class WorkoutSetPayload(BaseModel):
    """Фактический подход, который присылает клиент."""

    model_config = ConfigDict(extra="forbid")

    reps: Optional[int] = Field(default=None, ge=0, le=1000)
    weight_kg: Optional[float] = Field(default=None, gt=0, le=500)
    duration_sec: Optional[int] = Field(default=None, ge=1, le=86400)
    distance_m: Optional[float] = Field(default=None, gt=0, le=100000)
    skipped: bool = False

    @model_validator(mode="after")
    def _require_result(self) -> "WorkoutSetPayload":
        if self.skipped:
            return self
        has_result = any(
            value is not None
            for value in (
                self.reps,
                self.duration_sec,
                self.distance_m,
            )
        )
        if not has_result:
            raise ValueError(
                "Укажите повторения, длительность или дистанцию "
                "либо отметьте подход пропущенным."
            )
        return self


class ExerciseResultPayload(BaseModel):
    """Фактический результат одного упражнения."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    comment: Optional[str] = Field(default=None, max_length=2000)
    sets: List[WorkoutSetPayload] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Название упражнения не может быть пустым.")
        return cleaned


class WorkoutExercisesRequest(BaseModel):
    """Полная замена фактических результатов тренировки."""

    model_config = ConfigDict(extra="forbid")

    exercises: List[ExerciseResultPayload] = Field(
        default_factory=list, max_length=50
    )


class WorkoutCreateRequest(BaseModel):
    """Старт тренировки по плану или самостоятельной."""

    model_config = ConfigDict(extra="forbid")

    planned_workout_id: Optional[str] = None
    program_id: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=200)

    @field_validator("title")
    @classmethod
    def _clean_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def _require_source(self) -> "WorkoutCreateRequest":
        if not self.planned_workout_id and not self.title:
            raise ValueError(
                "Укажите плановую тренировку или название самостоятельной."
            )
        return self


class WorkoutUpdateRequest(BaseModel):
    """Изменение статуса, комментария или самочувствия."""

    model_config = ConfigDict(extra="forbid")

    status: Optional[WorkoutStatus] = None
    comment: Optional[str] = Field(default=None, max_length=2000)
    perceived_exertion: Optional[int] = Field(default=None, ge=1, le=10)

    @model_validator(mode="after")
    def _require_change(self) -> "WorkoutUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Нужно указать хотя бы одно изменение.")
        return self


class WorkoutSetView(BaseModel):
    """Сохранённый подход."""

    id: str
    position: int
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    duration_sec: Optional[int] = None
    distance_m: Optional[float] = None
    skipped: bool = False


class ExerciseResultView(BaseModel):
    """Сохранённый результат упражнения."""

    id: str
    name: str
    position: int
    planned: Optional[Dict[str, Any]] = None
    comment: Optional[str] = None
    sets: List[WorkoutSetView] = Field(default_factory=list)


class WorkoutSummary(BaseModel):
    """Краткая запись тренировки для истории."""

    id: str
    title: str
    status: str
    program_id: Optional[str] = None
    planned_workout_id: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class WorkoutDetail(WorkoutSummary):
    """Тренировка с упражнениями и подходами."""

    perceived_exertion: Optional[int] = None
    comment: Optional[str] = None
    exercises: List[ExerciseResultView] = Field(default_factory=list)


class WorkoutList(BaseModel):
    """Страница истории тренировок."""

    items: List[WorkoutSummary] = Field(default_factory=list)
    total: int = 0


class ProgramStat(BaseModel):
    """Количество завершённых тренировок по программе."""

    program_id: str
    name: str
    completed_count: int


class WorkoutStats(BaseModel):
    """Базовая статистика без медицинских выводов."""

    completed_total: int = 0
    completed_last_7_days: int = 0
    completed_last_30_days: int = 0
    by_program: List[ProgramStat] = Field(default_factory=list)
    recent_dates: List[datetime] = Field(default_factory=list)


class ExerciseNameStat(BaseModel):
    """Упражнение, встречавшееся в завершённых тренировках."""

    name: str
    completed_sessions: int


class ExerciseNameList(BaseModel):
    items: List[ExerciseNameStat] = Field(default_factory=list)


class ExerciseProgressPoint(BaseModel):
    """Одна точка динамики упражнения."""

    date: datetime
    top_weight_kg: float
    total_reps: int
    total_volume_kg: float
