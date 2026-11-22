"""Компактный read-only контекст для будущих AI-функций."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CoachProfile(BaseModel):
    goal: Optional[str] = None
    experience_level: Optional[str] = None
    days_per_week: Optional[int] = None
    minutes_per_session: Optional[int] = None
    limitations: List[str] = Field(default_factory=list)


class CoachExerciseSummary(BaseModel):
    name: str
    sets_count: int = 0
    top_weight_kg: Optional[float] = None
    total_reps: int = 0


class CoachWorkoutSummary(BaseModel):
    workout_id: str
    title: str
    completed_at: Optional[datetime] = None
    comment: Optional[str] = None
    exercises: List[CoachExerciseSummary] = Field(default_factory=list)


class CoachProgramSummary(BaseModel):
    program_id: str
    name: str
    goal: Optional[str] = None
    workouts_count: int = 0


class CoachContext(BaseModel):
    """Только данные для чтения; LLM не получает доступа к записи."""

    profile: Optional[CoachProfile] = None
    active_program: Optional[CoachProgramSummary] = None
    recent_workouts: List[CoachWorkoutSummary] = Field(default_factory=list)
    completed_total: int = 0
    completed_last_7_days: int = 0
    completed_last_30_days: int = 0
    generated_at: datetime
