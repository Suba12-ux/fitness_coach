"""Проверки оркестрации (LLM-план, параллелизм, safety)."""

from typing import Any, Dict

from app.agents.base import BaseAgent
from app.agents.profile_agent import ProfileAgent
from app.agents.safety_checker import SafetyChecker
from app.agents.supervisor import Supervisor
from app.llm.mock import MockLLMProvider
from app.schemas.results import AgentResult, AgentStatus, PlanStatus
from app.schemas.tasks import AgentTask


def full_data() -> Dict[str, Any]:
    return {
        "goal": "общая физическая форма",
        "age": 30,
        "weight_kg": 75.0,
        "height_cm": 178.0,
        "experience_level": "beginner",
        "days_per_week": 3,
        "minutes_per_session": 45,
        "limitations": [],
    }


def make_supervisor(training_agent: BaseAgent, max_retries: int = 3) -> Supervisor:
    return Supervisor(
        profile_agent=ProfileAgent(),
        training_agent=training_agent,
        safety_checker=SafetyChecker(),
        llm=MockLLMProvider(),
        max_retries=max_retries,
    )


class FixedResultAgent(BaseAgent):
    """Возвращает один и тот же результат, считая вызовы."""

    def __init__(self, result: AgentResult) -> None:
        self.result = result
        self.calls = 0

    def run(self, task: AgentTask) -> AgentResult:
        self.calls += 1
        return self.result


class RaisingAgent(BaseAgent):
    """Всегда падает с исключением, считая вызовы."""

    def __init__(self) -> None:
        self.calls = 0

    def run(self, task: AgentTask) -> AgentResult:
        self.calls += 1
        raise RuntimeError("агент сломался")


def success_result(task_id: str, data: Dict[str, Any]) -> AgentResult:
    return AgentResult(task_id=task_id, status=AgentStatus.SUCCESS, data=data)


def test_full_flow_success() -> None:
    from app.agents.training_agent import TrainingAgent

    state = make_supervisor(TrainingAgent()).run(
        request="Подготовь базовый план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.DONE
    assert state.final_answer is not None
    plan = state.final_answer["plan"]
    assert plan["goal"] == "общая физическая форма"
    assert len(plan["sessions"]) == 3


def test_missing_data_reports_fields() -> None:
    from app.agents.training_agent import TrainingAgent

    state = make_supervisor(TrainingAgent()).run(
        request="Подготовь план тренировок.",
        user_data={"age": 30},
    )

    assert state.status == PlanStatus.NEEDS_INFO
    assert state.final_answer is not None
    missing = set(state.final_answer["missing_data"])
    assert {"goal", "experience_level", "days_per_week", "minutes_per_session"} <= missing


def test_agent_error_does_not_produce_success() -> None:
    state = make_supervisor(RaisingAgent()).run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.ERROR
    assert state.final_answer is not None
    assert "error" in state.final_answer


def test_invalid_result_rejected_by_schema() -> None:
    # План без sessions не проходит валидацию схемы TrainingPlan.
    bad = success_result("training", {"goal": "цель"})
    agent = FixedResultAgent(bad)

    state = make_supervisor(agent).run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.ERROR
    assert "Невалидный ответ агента" in state.final_answer["error"]


def test_invalid_result_rejected_by_constraint() -> None:
    # Отрицательная длительность не проходит бизнес-проверки.
    bad = success_result(
        "training",
        {
            "goal": "цель",
            "sessions": [{"day": "Пн", "activity": "бег", "duration_min": -5}],
        },
    )
    agent = FixedResultAgent(bad)

    state = make_supervisor(agent).run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.ERROR
    assert "Некорректная длительность" in state.final_answer["error"]


def test_retry_limit_is_respected() -> None:
    agent = RaisingAgent()
    max_retries = 3

    state = make_supervisor(agent, max_retries=max_retries).run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert agent.calls == max_retries
    assert state.status == PlanStatus.ERROR


def test_result_contains_assumptions_and_warnings() -> None:
    from app.agents.training_agent import TrainingAgent

    data = full_data()
    data.pop("age")  # возраст не указан → Training Agent должен пометить предположение

    state = make_supervisor(TrainingAgent()).run(
        request="Подготовь план тренировок.",
        user_data=data,
    )

    assert state.status == PlanStatus.DONE
    assert state.final_answer is not None
    assert state.final_answer["plan"]["assumptions"]
    assert state.final_answer["warnings"]


def test_llm_infers_goal_from_request() -> None:
    from app.agents.training_agent import TrainingAgent

    data = full_data()
    data.pop("goal")

    state = make_supervisor(TrainingAgent()).run(
        request="Хочу похудеть, нужен план тренировок.",
        user_data=data,
    )

    assert state.status == PlanStatus.DONE
    assert state.final_answer["plan"]["goal"] == "снижение веса"


def test_parallel_training_and_safety_run() -> None:
    from app.agents.training_agent import TrainingAgent

    state = make_supervisor(TrainingAgent()).run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.DONE
    assert "training" in state.results
    assert "safety" in state.results
    assert state.results["training"].status == AgentStatus.SUCCESS
    assert state.results["safety"].status == AgentStatus.SUCCESS
    assert "safety" in state.final_answer


def test_safety_critical_issue_blocks_plan() -> None:
    from app.agents.training_agent import TrainingAgent

    data = full_data()
    data["days_per_week"] = 7

    state = make_supervisor(TrainingAgent()).run(
        request="Подготовь план тренировок.",
        user_data=data,
    )

    assert state.status == PlanStatus.ERROR
    assert state.final_answer["message"] == "Проверка безопасности не пройдена."


def test_plan_without_profile_is_rejected() -> None:
    from app.agents.training_agent import TrainingAgent
    from app.schemas.llm import TaskPlan, TaskSpec
    from app.schemas.tasks import TaskType

    class NoProfileLLM:
        async def generate(self, messages, response_schema=None):
            return TaskPlan(
                goal="цель",
                tasks=[
                    TaskSpec(id="training", type=TaskType.TRAINING, depends_on=["profile"]),
                    TaskSpec(id="safety", type=TaskType.SAFETY, depends_on=["profile"]),
                ],
            ).model_dump()

    supervisor = Supervisor(
        profile_agent=ProfileAgent(),
        training_agent=TrainingAgent(),
        safety_checker=SafetyChecker(),
        llm=NoProfileLLM(),
        max_retries=3,
    )

    state = supervisor.run(
        request="Подготовь план тренировок.",
        user_data=full_data(),
    )

    assert state.status == PlanStatus.ERROR
    assert "profile" in state.final_answer["error"]
