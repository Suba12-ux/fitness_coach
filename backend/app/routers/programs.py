"""HTTP-эндпоинты сохранённых программ."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.db.models.user import User
from app.schemas.programs import (
    ProgramCreateRequest,
    ProgramDetail,
    ProgramList,
    ProgramStatus,
    ProgramUpdateRequest,
)
from app.services import programs as program_service

router = APIRouter(prefix="/programs", tags=["programs"])


async def _require_program(session, program_id: str, user_id: str):
    program = await program_service.get_program_for_user(
        session, program_id, user_id
    )
    if program is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Программа не найдена.",
        )
    return program


@router.post(
    "", response_model=ProgramDetail, status_code=http_status.HTTP_201_CREATED
)
async def create_program(
    body: ProgramCreateRequest,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgramDetail:
    try:
        program, created = await program_service.create_program_from_run(
            session, user.id, body
        )
    except program_service.ProgramSourceNotFound as exc:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except (
        program_service.ProgramSourceNotReady,
        program_service.ProgramContentInvalid,
    ) as exc:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)
        )

    if not created:
        response.status_code = http_status.HTTP_200_OK
    return await program_service.build_detail(session, program, user.id)


@router.get("", response_model=ProgramList)
async def list_programs(
    status: Optional[ProgramStatus] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgramList:
    programs, counts, total = await program_service.list_programs_for_user(
        session, user.id, status=status, limit=limit, offset=offset
    )
    return ProgramList(
        items=[
            program_service.to_summary(program, counts.get(program.id, 0))
            for program in programs
        ],
        total=total,
    )


@router.get("/{program_id}", response_model=ProgramDetail)
async def get_program(
    program_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgramDetail:
    program = await _require_program(session, program_id, user.id)
    return await program_service.build_detail(session, program, user.id)


@router.patch("/{program_id}", response_model=ProgramDetail)
async def patch_program(
    program_id: str,
    body: ProgramUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgramDetail:
    program = await _require_program(session, program_id, user.id)
    program = await program_service.update_program(
        session,
        program,
        name=body.name,
        description=body.description,
        status=body.status,
    )
    return await program_service.build_detail(session, program, user.id)


@router.delete(
    "/{program_id}", status_code=http_status.HTTP_204_NO_CONTENT
)
async def delete_program(
    program_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    program = await _require_program(session, program_id, user.id)
    await program_service.archive_program(session, program)
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
