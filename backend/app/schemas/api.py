"""Схемы HTTP-эндпоинтов."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class WorkflowRequest(BaseModel):
    """Тело запроса на запуск процесса."""

    request: str
    user_data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowResponse(BaseModel):
    """Ответ API после запуска или чтения процесса."""

    run_id: str
    status: str
    request: str
    final_answer: Optional[Dict[str, Any]] = None
    missing_data: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    user_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class WorkflowListItem(BaseModel):
    """Краткая информация о запуске для списка истории."""

    run_id: str
    status: str
    request: str
    created_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None


class WorkflowList(BaseModel):
    """Страница списка запусков."""

    items: List[WorkflowListItem] = Field(default_factory=list)
    total: int = 0
