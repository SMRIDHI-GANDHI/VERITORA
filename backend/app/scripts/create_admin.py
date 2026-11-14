import argparse
import asyncio
import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models.user import User
from app.db.session import SessionLocal


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote an admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Admin")
    parser.add_argument("--password", default=None)
    args = parser.parse_args()
    password = args.password or getpass.getpass("Admin password: ")

    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == args.email.lower()))
        user = result.scalar_one_or_none()
        if user:
            user.role = "admin"
            user.is_active = True
            if password:
                user.password_hash = hash_password(password)
            action = "updated"
        else:
            user = User(
                name=args.name,
                email=args.email.lower(),
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
            db.add(user)
            action = "created"
        await db.commit()
        print(f"Admin {action}: {user.email} ({user.id})")


if __name__ == "__main__":
    asyncio.run(main())
