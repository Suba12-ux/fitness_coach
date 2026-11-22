"""Схемы LLM-планирования."""

from typing import List

from pydantic import BaseModel, Field

from app.schemas.tasks import TaskType


class TaskSpec(BaseModel):
    """Одна подзадача в плане, предложенном LLM."""

    id: str
    type: TaskType
    depends_on: List[str] = Field(default_factory=list)


class TaskPlan(BaseModel):
    """План: цель и список подзадач в рамках разрешённого набора."""

    goal: str
    tasks: List[TaskSpec] = Field(default_factory=list)
