# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Role-based login for student and staff accounts
- Sign up for activities as an authenticated user
- Staff-only unregister capability

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| POST   | `/auth/login?username=<username>&password=<password>`            | Log in and receive a Bearer token                                  |
| POST   | `/auth/logout`                                                    | Log out and invalidate the current token                           |
| GET    | `/auth/me`                                                        | Get current authenticated session details                          |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity                                             |
| DELETE | `/activities/{activity_name}/unregister?email=student@...`       | Staff-only unregister endpoint                                      |

Protected endpoints require an `Authorization: Bearer <token>` header.

Demo accounts:

- `student-emma` / `student123`
- `student-sophia` / `student123`
- `staff-mr-lee` / `staff123`
- `staff-ms-wilson` / `staff123`

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
