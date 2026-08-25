"""
Seed Script — creates demo users on first run if users table is empty.

Users created:
  engineer1 / demo1234   (role: engineer)
  admin     / admin1234  (role: admin)

Run standalone:
    cd backend
    python seed.py

Or called automatically from main.py startup event.
"""

from app.database import SessionLocal, User, create_tables
from app.auth import hash_password


DEMO_USERS = [
    {"username": "engineer1", "password": "demo1234",  "role": "engineer"},
    {"username": "approver1", "password": "demo1234",  "role": "approver"},
    {"username": "admin1",     "password": "admin1234", "role": "admin"},
]


def seed_users() -> None:
    create_tables()
    db = SessionLocal()
    try:
        count = db.query(User).count()
        if count > 0:
            print(f"[seed] Users table already has {count} rows — skipping seed.")
            return

        for u in DEMO_USERS:
            user = User(
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
            )
            db.add(user)

        db.commit()
        print(f"[seed] Seeded {len(DEMO_USERS)} demo users.")
        for u in DEMO_USERS:
            print(f"       * {u['username']} / {u['password']}  ({u['role']})")
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
