"""Supervisor: LLM-план, контроль зависимостей, параллельное выполнение.

LLM предлагает план и выбирает действия в рамках разрешённого набора;
критические проверки, порядок выполнения и валидация остаются в обычном коде.
"""

import asyncio
import json
from collections import deque
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.agents.base import BaseAgent
from app.llm.base import LLMError, LLMProvider
from app.schemas.llm import TaskPlan, TaskSpec
from app.schemas.results import (
    AgentResult,
    AgentStatus,
    PlanState,
    PlanStatus,
    SafetyReport,
    TrainingPlan,
    UserProfile,
)
from app.schemas.tasks import AgentTask, TaskType

Validator = Callable[[Optional[Dict[str, Any]]], Any]

ALLOWED_TASK_TYPES = {TaskType.PROFILE, TaskType.TRAINING, TaskType.SAFETY}

PLANNER_SYSTEM_PROMPT = (
    "Ты планировщик фитнес-задач. По запросу пользователя верни строгий JSON "
    "со структурой {\"goal\": str, \"tasks\": [{\"id\": str, \"type\": str, "
    "\"depends_on\": [str]}]}. Разрешённые типы задач: profile, training, safety. "
    "Задача profile обязательна и ни от чего не зависит; training и safety должны "
    "зависеть от profile. Не выдумывай данные пользователя."
)


class Supervisor:
    """Оркестрирует субагентов, контролируя статусы и результаты."""

    def __init__(
        self,
        profile_agent: BaseAgent,
        training_agent: BaseAgent,
        safety_checker: Optional[BaseAgent] = None,
        llm: Optional[LLMProvider] = None,
        max_retries: int = 3,
        timeout_seconds: float = 10.0,
    ) -> None:
        self.profile_agent = profile_agent
        self.training_agent = training_agent
        self.safety_checker = safety_checker
        self.llm = llm
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds

    # ---------------------------------------------------------------- sync API
    def run(self, request: str, user_data: Dict[str, Any]) -> PlanState:
        return asyncio.run(self.run_async(request, user_data))

    # --------------------------------------------------------------- async API
    async def run_async(self, request: str, user_data: Dict[str, Any]) -> PlanState:
        state = PlanState(request=request, status=PlanStatus.RUNNING)

        try:
            plan = await self._make_plan(request, user_data)
            self._validate_task_plan(plan)
            layers = self._topological_layers(plan)
        except LLMError as exc:
            state.status = PlanStatus.ERROR
            state.final_answer = {"message": "Ошибка планирования.", "error": str(exc)}
            return state

        profile_spec = next(
            spec for spec in plan.tasks if spec.type == TaskType.PROFILE
        )
        profile_input = dict(user_data)
        if plan.goal and not profile_input.get("goal"):
            profile_input["goal"] = plan.goal

        profile: Optional[UserProfile] = None
        profile_result: Optional[AgentResult] = None

        for layer in layers:
            jobs: List[Tuple[AgentTask, BaseAgent, Validator]] = []
            for spec in layer:
                prepared = self._agent_for(spec)
                if prepared is None:
                    state.results[spec.id] = AgentResult(
                        task_id=spec.id,
                        status=AgentStatus.ERROR,
                        error=f"Нет агента для задачи типа {spec.type.value}.",
                    )
                    continue
                agent, validator = prepared

                if spec.type == TaskType.PROFILE:
                    task = AgentTask(
                        id=spec.id, type=spec.type, input=profile_input
                    )
                else:
                    if profile is None:
                        state.results[spec.id] = AgentResult(
                            task_id=spec.id,
                            status=AgentStatus.ERROR,
                            error="Профиль пользователя недоступен.",
                        )
                        continue
                    task = AgentTask(
                        id=spec.id,
                        type=spec.type,
                        input={"profile": profile.model_dump()},
                    )

                state.tasks.append(task)
                jobs.append((task, agent, validator))

            if jobs:
                results = await asyncio.gather(
                    *[
                        self._run_with_retry(agent, task, validator)
                        for task, agent, validator in jobs
                    ]
                )
                for (task, _agent, _validator), result in zip(jobs, results):
                    state.results[task.id] = result

            # Профиль завершился на одном из слоёв — обработать его результат.
            if profile is None and profile_spec.id in state.results:
                profile_result = state.results[profile_spec.id]
                if profile_result.status == AgentStatus.NEEDS_INFO:
                    state.status = PlanStatus.NEEDS_INFO
                    state.final_answer = {
                        "message": "Недостаточно данных для построения плана.",
                        "missing_data": profile_result.missing_data,
                        "warnings": profile_result.warnings,
                    }
                    return state
                if profile_result.status == AgentStatus.ERROR:
                    state.status = PlanStatus.ERROR
                    state.final_answer = {
                        "message": "Не удалось получить профиль пользователя.",
                        "error": profile_result.error,
                    }
                    return state
                profile = UserProfile.model_validate(profile_result.data)
                state.profile = profile

        assert profile is not None and profile_result is not None
        return self._merge(state, plan, profile, profile_result)

    # ------------------------------------------------------------- planning
    async def _make_plan(self, request: str, user_data: Dict[str, Any]) -> TaskPlan:
        if self.llm is None:
            raise LLMError("LLM-провайдер не настроен.")
        messages = [
            {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"request": request, "user_data": user_data},
                    ensure_ascii=False,
                ),
            },
        ]
        data = await self.llm.generate(messages, response_schema=TaskPlan)
        return TaskPlan.model_validate(data)

    @staticmethod
    def _validate_task_plan(plan: TaskPlan) -> None:
        if not plan.tasks:
            raise LLMError("LLM вернул пустой план задач.")
        ids = [spec.id for spec in plan.tasks]
        if len(set(ids)) != len(ids):
            raise LLMError("В плане LLM есть дубликаты идентификаторов задач.")

        by_id = {spec.id: spec for spec in plan.tasks}
        unknown = [
            spec.type.value for spec in plan.tasks if spec.type not in ALLOWED_TASK_TYPES
        ]
        if unknown:
            raise LLMError(f"Недопустимые типы задач в плане LLM: {unknown}")

        profile_specs = [s for s in plan.tasks if s.type == TaskType.PROFILE]
        if len(profile_specs) != 1:
            raise LLMError("План LLM должен содержать ровно одну задачу profile.")
        profile_id = profile_specs[0].id

        for spec in plan.tasks:
            for dep in spec.depends_on:
                if dep not in by_id:
                    raise LLMError(
                        f"Задача {spec.id} ссылается на неизвестную задачу {dep}."
                    )
            if spec.type != TaskType.PROFILE and profile_id not in spec.depends_on:
                raise LLMError(
                    f"Задача {spec.id} должна зависеть от profile."
                )

    @staticmethod
    def _topological_layers(plan: TaskPlan) -> List[List[TaskSpec]]:
        """Вернуть слои задач, которые можно выполнять последовательно."""
        by_id = {spec.id: spec for spec in plan.tasks}
        indegree = {spec.id: 0 for spec in plan.tasks}
        dependents: Dict[str, List[str]] = {spec.id: [] for spec in plan.tasks}

        for spec in plan.tasks:
            for dep in spec.depends_on:
                indegree[spec.id] += 1
                dependents[dep].append(spec.id)

        queue = deque(spec.id for spec in plan.tasks if indegree[spec.id] == 0)
        layers: List[List[TaskSpec]] = []
        visited = 0

        while queue:
            layer = [by_id[tid] for tid in queue]
            layers.append(layer)
            next_queue = []
            for tid in queue:
                visited += 1
                for child in dependents[tid]:
                    indegree[child] -= 1
                    if indegree[child] == 0:
                        next_queue.append(child)
            queue = deque(next_queue)

        if visited != len(plan.tasks):
            raise LLMError("В плане LLM обнаружен цикл зависимостей.")
        return layers

    # ------------------------------------------------------------- execution
    def _agent_for(
        self, spec: TaskSpec
    ) -> Optional[Tuple[BaseAgent, Validator]]:
        if spec.type == TaskType.PROFILE:
            return self.profile_agent, UserProfile.model_validate
        if spec.type == TaskType.TRAINING:
            return self.training_agent, self._validate_training_plan
        if spec.type == TaskType.SAFETY:
            if self.safety_checker is None:
                return None
            return self.safety_checker, SafetyReport.model_validate
        return None

    async def _run_with_retry(
        self,
        agent: BaseAgent,
        task: AgentTask,
        validate: Validator,
    ) -> AgentResult:
        last_error: Optional[AgentResult] = None

        for _ in range(self.max_retries):
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(agent.run, task),
                    timeout=self.timeout_seconds,
                )
            except asyncio.TimeoutError:
                result = AgentResult(
                    task_id=task.id,
                    status=AgentStatus.ERROR,
                    error=f"Таймаут агента: {self.timeout_seconds} сек.",
                )
            except Exception as exc:
                result = AgentResult(
                    task_id=task.id,
                    status=AgentStatus.ERROR,
                    error=f"{type(exc).__name__}: {exc}",
                )

            if result.status == AgentStatus.NEEDS_INFO:
                return result

            if result.status == AgentStatus.ERROR:
                last_error = result
                continue

            try:
                validate(result.data)
            except Exception as exc:
                last_error = AgentResult(
                    task_id=task.id,
                    status=AgentStatus.ERROR,
                    error=f"Невалидный ответ агента: {exc}",
                )
                continue

            return result

        return last_error or AgentResult(
            task_id=task.id,
            status=AgentStatus.ERROR,
            error="Превышен лимит повторов.",
        )

    # -------------------------------------------------------------- merge
    def _merge(
        self,
        state: PlanState,
        plan: TaskPlan,
        profile: UserProfile,
        profile_result: AgentResult,
    ) -> PlanState:
        training_result = self._result_for_type(state, plan, TaskType.TRAINING)
        safety_result = self._result_for_type(state, plan, TaskType.SAFETY)

        if training_result is None or training_result.status == AgentStatus.ERROR:
            state.status = PlanStatus.ERROR
            error = (
                training_result.error
                if training_result is not None
                else "LLM не назначил задачу training."
            )
            state.final_answer = {
                "message": "Не удалось сформировать тренировочный план.",
                "error": error,
            }
            return state

        plan_obj = TrainingPlan.model_validate(training_result.data)

        safety_issues = []
        safety_error: Optional[str] = None
        if safety_result is not None and safety_result.status == AgentStatus.SUCCESS:
            report = SafetyReport.model_validate(safety_result.data)
            safety_issues = report.issues
            errors = [i for i in safety_issues if i.severity == "error"]
            if errors:
                safety_error = "; ".join(i.message for i in errors)

        warnings = self._collect_warnings(profile_result, training_result, safety_issues)

        if safety_error:
            state.status = PlanStatus.ERROR
            state.final_answer = {
                "message": "Проверка безопасности не пройдена.",
                "error": safety_error,
                "safety_issues": [i.model_dump() for i in safety_issues],
            }
            return state

        state.status = PlanStatus.DONE
        state.final_answer = {
            "profile": profile.model_dump(),
            "plan": plan_obj.model_dump(),
            "safety": SafetyReport(issues=safety_issues).model_dump(),
            "warnings": warnings,
        }
        return state

    @staticmethod
    def _result_for_type(
        state: PlanState, plan: TaskPlan, task_type: TaskType
    ) -> Optional[AgentResult]:
        for spec in plan.tasks:
            if spec.type == task_type:
                return state.results.get(spec.id)
        return None

    @staticmethod
    def _collect_warnings(*sources: Any) -> List[str]:
        warnings: List[str] = []
        for source in sources:
            if source is None:
                continue
            if isinstance(source, AgentResult):
                warnings.extend(source.warnings)
            elif isinstance(source, list):
                for item in source:
                    warnings.append(item.message)
        return warnings

    @staticmethod
    def _validate_training_plan(data: Optional[Dict[str, Any]]) -> TrainingPlan:
        plan = TrainingPlan.model_validate(data)
        if not plan.goal:
            raise ValueError("В плане отсутствует цель.")
        if not plan.sessions:
            raise ValueError("В плане нет ни одной тренировки.")
        for session in plan.sessions:
            if not session.day or not session.activity:
                raise ValueError("У тренировки не указан день или активность.")
            if session.duration_min <= 0:
                raise ValueError(
                    f"Некорректная длительность тренировки: {session.duration_min} мин."
                )
        return plan
