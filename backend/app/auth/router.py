"""HTTP-эндпоинты регистрации, входа и управления сессиями."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cookies import clear_session_cookie, set_session_cookie
from app.auth.dependencies import (
    client_host,
    get_current_session,
    get_current_user,
    get_db,
)
from app.auth.rate_limit import LoginRateLimiter
from app.config import settings
from app.db.models.user import User, UserSession
from app.db.repositories import auth_repository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    SessionResponse,
    UserResponse,
)
from app.security.passwords import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    verify_password,
)
from app.security.tokens import hash_session_token, new_session_token

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = LoginRateLimiter(
    settings.auth_login_rate_limit,
    settings.auth_login_rate_window_seconds,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _user_agent(request: Request) -> Optional[str]:
    value = (request.headers.get("user-agent") or "").strip()
    return value[:255] or None


def _rate_key(email: str, request: Request) -> str:
    return f"{email}|{client_host(request)}"


async def _start_session(
    session: AsyncSession,
    user: User,
    request: Request,
    response: Response,
    *,
    persistent: bool,
) -> None:
    token = new_session_token()
    expires_at = _utcnow() + timedelta(days=settings.auth_session_ttl_days)
    await auth_repository.create_session(
        session,
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=expires_at,
        user_agent=_user_agent(request),
        persistent=persistent,
    )
    set_session_cookie(response, token, persistent=persistent)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> User:
    existing = await auth_repository.get_user_by_email(session, body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже зарегистрирован.",
        )

    try:
        user = await auth_repository.create_user(
            session,
            email=body.email,
            password_hash=hash_password(body.password),
        )
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже зарегистрирован.",
        )

    await _start_session(
        session, user, request, response, persistent=body.remember_me
    )
    return user


@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> User:
    key = _rate_key(body.email, request)
    if login_limiter.is_limited(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток входа. Попробуйте позже.",
        )

    user = await auth_repository.get_user_by_email(session, body.email)
    password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    valid = verify_password(body.password, password_hash)

    if user is None or not valid:
        login_limiter.register_failure(key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль.",
        )

    login_limiter.reset(key)
    await _start_session(
        session, user, request, response, persistent=body.remember_me
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> Response:
    token = request.cookies.get(settings.auth_cookie_name)
    if token:
        await auth_repository.delete_session_by_token_hash(
            session, hash_session_token(token)
        )
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    await auth_repository.delete_user_sessions(session, current_user.id)
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db),
) -> List[SessionResponse]:
    records = await auth_repository.list_sessions(
        session, current_user.id, now=_utcnow()
    )
    return [
        SessionResponse(
            id=record.id,
            user_agent=record.user_agent,
            created_at=record.created_at,
            last_used_at=record.last_used_at,
            expires_at=record.expires_at,
            is_current=record.id == current_session.id,
        )
        for record in records
    ]


@router.delete(
    "/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_session(
    session_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db),
) -> Response:
    record = await auth_repository.get_user_session(
        session, session_id, current_user.id
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сессия не найдена.",
        )

    await auth_repository.delete_session_by_id(session, record.id)
    if record.id == current_session.id:
        clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(
        body.current_password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль неверен.",
        )
    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего.",
        )

    await auth_repository.update_password_hash(
        session, current_user, hash_password(body.new_password)
    )
    await auth_repository.delete_user_sessions(session, current_user.id)
    await _start_session(
        session,
        current_user,
        request,
        response,
        persistent=current_session.persistent,
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
