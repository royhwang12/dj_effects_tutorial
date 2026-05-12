# DJ Effects Tutorial (HW10 Technical Prototype)

Flask + HTML/JS/jQuery/Bootstrap implementation of the Week 10 prototype.

# Team Members

- Roy Hwang — roywhang12
- Adam Kleshchelski — akleshchelki

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## Required HW10 Routes

- `/` home screen with start button
- `/learn/<lesson_id>` learning pages
- `/quiz/<quiz_id>` quiz pages
- `/quiz/results` quiz result page

## Backend Tracking

- Start event is stored at `/api/start`
- User interactions are stored at `/api/track`
- Quiz answers are stored on submit to `/quiz/<quiz_id>`
- Current session data is visible at `/api/state`
