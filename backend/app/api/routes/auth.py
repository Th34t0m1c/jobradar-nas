import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Depends, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.schemas import (
    LoginRequest, RegisterRequest, UserResponse, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse,
    UpdateProfileRequest, ChangePasswordRequest,
)
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.models import User, PasswordResetToken
from app.services.email_service import send_reset_email

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_EXPIRE_HOURS = 1


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account. Email must be unique. Password must be at least 8 characters.",
)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if body.password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description=(
        "Authenticate with email and password. "
        "Returns a Bearer JWT (`access_token`) valid for 30 minutes. "
        "Include it in subsequent requests as: `Authorization: Bearer <token>`. "
        "Rate-limited to 5 requests per minute per IP."
    ),
)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=token)


@router.post(
    "/logout",
    summary="Log out",
    description="Token-based logout. The client should discard its stored token. No server-side action is required.",
)
async def logout():
    return {"message": "Logged out — discard your token"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Returns the profile of the currently authenticated user.",
)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset",
    description=(
        "Sends a password reset link to the given email if an active account exists. "
        "Always returns 200 to prevent email enumeration. "
        "Rate-limited to 3 requests per minute per IP."
    ),
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    _generic = MessageResponse(
        message="If an account exists with that email, you will receive a reset link shortly."
    )

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return _generic

    # Invalidate any prior unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).delete(synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS),
    ))
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    await send_reset_email(user.email, reset_link)

    return _generic


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password",
    description="Validates the reset token and updates the user's password. Token is single-use and expires after 1 hour.",
)
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if body.new_password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user.hashed_password = get_password_hash(body.new_password)
    reset_token.used_at = datetime.utcnow()
    db.commit()

    return MessageResponse(message="Password reset successfully. You can now sign in.")


@router.patch(
    "/profile",
    response_model=UserResponse,
    summary="Update profile",
    description="Update the current user's full name and/or email.",
)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.email and body.email != current_user.email:
        conflict = db.query(User).filter(User.email == body.email).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        current_user.email = body.email

    if body.full_name is not None:
        current_user.full_name = body.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password",
    description="Change the current user's password. Requires the existing password for verification.",
)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    return MessageResponse(message="Password changed successfully.")
