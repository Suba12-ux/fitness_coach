"""Схемы постоянного профиля пользователя."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]


class ProfileData(BaseModel):
    """Поля профиля, которые пользователь может редактировать."""

    model_config = ConfigDict(extra="forbid")

    goal: Optional[str] = Field(default=None, max_length=255)
    age: Optional[int] = Field(default=None, ge=10, le=100)
    weight_kg: Optional[float] = Field(default=None, ge=30, le=300)
    height_cm: Optional[float] = Field(default=None, ge=100, le=250)
    experience_level: Optional[ExperienceLevel] = None
    days_per_week: Optional[int] = Field(default=None, ge=1, le=6)
    minutes_per_session: Optional[int] = Field(default=None, ge=15, le=180)
    limitations: List[str] = Field(default_factory=list)

    @field_validator("goal")
    @classmethod
    def _clean_goal(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("limitations")
    @classmethod
    def _clean_limitations(cls, values: List[str]) -> List[str]:
        cleaned: List[str] = []
        for value in values:
            text = value.strip()
            if not text:
                continue
            if len(text) > 200:
                raise ValueError("Ограничение не должно превышать 200 символов.")
            if text not in cleaned:
                cleaned.append(text)
        if len(cleaned) > 20:
            raise ValueError("Допускается не более 20 ограничений.")
        return cleaned


class ProfileResponse(ProfileData):
    """Профиль вместе со служебными временными метками."""

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
