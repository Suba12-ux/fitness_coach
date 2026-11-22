"""Запускаемый пример расширенного прототипа.

Использование:
    python -m app.main
"""

import asyncio
import json
import sys

from app.db.session import create_all
from app.schemas.results import PlanStatus
from app.services.workflow import run_workflow, run_workflow_persisted


def main() -> None:
    # Корректный вывод кириллицы в консоли Windows.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    asyncio.run(create_all())

    request = "Подготовь базовый план тренировок."

    # Полный набор данных — процесс должен завершиться успешно.
    user_data = {
        "goal": "общая физическая форма",
        "age": 30,
        "weight_kg": 75.0,
        "height_cm": 178.0,
        "experience_level": "beginner",
        "days_per_week": 3,
        "minutes_per_session": 45,
        "limitations": [],
    }

    state, run_id = run_workflow_persisted(request=request, user_data=user_data)
    print(f"run_id: {run_id}")
    print(json.dumps(state.model_dump(), ensure_ascii=False, indent=2))

    # Пример с нехваткой данных.
    incomplete = run_workflow(request=request, user_data={"age": 30})
    print("\n--- Недостаточно данных ---")
    print(json.dumps(incomplete.model_dump(), ensure_ascii=False, indent=2))

    assert state.status == PlanStatus.DONE


if __name__ == "__main__":
    main()
