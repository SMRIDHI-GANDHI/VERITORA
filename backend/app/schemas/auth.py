from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    role: str
    preferred_language: str | None = None
    explanation_language: str | None = None
    theme: str | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    preferred_language: str | None = Field(default=None, pattern="^(en|hi)$")
    explanation_language: str | None = Field(default=None, pattern="^(en|hi)$")
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
