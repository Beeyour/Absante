import hmac
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import create_access_token, require_doctor
from app.config import Settings, get_settings
from app.schemas import DoctorLoginRequest, TokenOut

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/doctor/login", response_model=TokenOut)
def doctor_login(
    payload: DoctorLoginRequest, settings: Settings = Depends(get_settings)
) -> TokenOut:
    given = payload.password.encode("utf-8")
    expected = settings.doctor_password.encode("utf-8")
    aligned = given if len(given) == len(expected) else expected
    if len(given) != len(expected) or not hmac.compare_digest(aligned, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )
    return TokenOut(access_token=create_access_token(settings))


@router.get("/doctor/session")
def doctor_session(_: Dict[str, Any] = Depends(require_doctor)) -> dict:
    return {"role": "doctor", "authenticated": True}
