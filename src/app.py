"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from datetime import datetime, timedelta, timezone
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}

# Simple in-memory user store for role-based authentication.
USERS = {
    "student-emma": {
        "password": "student123",
        "role": "student",
        "email": "emma@mergington.edu"
    },
    "student-sophia": {
        "password": "student123",
        "role": "student",
        "email": "sophia@mergington.edu"
    },
    "staff-mr-lee": {
        "password": "staff123",
        "role": "staff",
        "email": "mr.lee@mergington.edu"
    },
    "staff-ms-wilson": {
        "password": "staff123",
        "role": "staff",
        "email": "ms.wilson@mergington.edu"
    }
}

# In-memory token session store.
sessions = {}
SESSION_TTL_HOURS = 2


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _create_session(username: str) -> dict:
    token = secrets.token_urlsafe(32)
    user = USERS[username]
    expires_at = _utcnow() + timedelta(hours=SESSION_TTL_HOURS)
    session = {
        "token": token,
        "username": username,
        "role": user["role"],
        "email": user["email"],
        "expires_at": expires_at
    }
    sessions[token] = session
    return session


def _normalize_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")

    token = authorization[len(prefix):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    return token


def get_current_session(authorization: Optional[str] = Header(default=None)) -> dict:
    token = _normalize_token(authorization)
    session = sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if session["expires_at"] <= _utcnow():
        sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Session has expired")

    return session


def require_roles(*allowed_roles: str):
    def _checker(session: dict = Depends(get_current_session)) -> dict:
        if session["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return session
    return _checker


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/auth/login")
def login(username: str, password: str):
    user = USERS.get(username)
    if not user or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session = _create_session(username)
    return {
        "token": session["token"],
        "username": session["username"],
        "role": session["role"],
        "email": session["email"],
        "expires_at": session["expires_at"].isoformat()
    }


@app.post("/auth/logout")
def logout(session: dict = Depends(get_current_session)):
    sessions.pop(session["token"], None)
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def auth_me(session: dict = Depends(get_current_session)):
    return {
        "username": session["username"],
        "role": session["role"],
        "email": session["email"],
        "expires_at": session["expires_at"].isoformat()
    }


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    session: dict = Depends(require_roles("student", "staff"))
):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Students can only sign up themselves; staff may register any student.
    if session["role"] == "student" and session["email"] != email:
        raise HTTPException(
            status_code=403,
            detail="Students can only sign up their own email"
        )

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    _: dict = Depends(require_roles("staff"))
):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
