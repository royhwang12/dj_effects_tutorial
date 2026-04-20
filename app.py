from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from flask import Flask, jsonify, redirect, render_template, request, url_for

app = Flask(__name__)

LESSONS: list[dict[str, Any]] = [
    {
        "id": 1,
        "tab": "home",
        "title": "Learn DJ Transition Effects",
        "subtitle": "Choose a guided lesson path or jump into practice.",
        "description": (
            "This app teaches the core purpose of each effect through examples and quick quizzes."
        ),
        "left_card": {
            "title": "Recommended path",
            "lines": [
                "1. Learn Filter",
                "2. Learn Echo",
                "3. Learn Reverb",
                "4. Compare situations",
                "5. Take the quiz",
            ],
        },
        "right_actions": [
            {"label": "Start Lesson", "target": 2, "color": "blue"},
            {"label": "Browse Effects", "target": 2, "color": "purple"},
            {"label": "Quick Practice", "target": 4, "color": "orange"},
        ],
    },
    {
        "id": 2,
        "tab": "effects",
        "title": "Choose an Effect",
        "subtitle": "Pick an effect card to open a lesson.",
        "effects": [
            {
                "name": "Filter",
                "summary": "Removes highs or lows for clean blending.",
                "accent": "blue",
                "target": 3,
            },
            {
                "name": "Echo",
                "summary": "Creates a repeating tail on the outgoing track.",
                "accent": "purple",
                "target": 4,
            },
            {
                "name": "Reverb",
                "summary": "Adds space and atmosphere to the sound.",
                "accent": "green",
                "target": 5,
            },
            {
                "name": "Noise FX",
                "summary": "Builds tension before a drop.",
                "accent": "orange",
                "target": 4,
            },
        ],
    },
    {
        "id": 3,
        "tab": "effects",
        "title": "Effect Lesson: Filter",
        "subtitle": "A filter sweeps the frequency spectrum.",
        "description": "Cut lows or highs gradually to smooth a blend.",
        "best_for": [
            "Smoothing a blend",
            "Slowly taking out energy",
            "Making space for the next track",
        ],
        "tip": "Tip: Sweep gradually. Sudden cuts sound unnatural.",
        "board": {
            "title": "DJ Controller - Filter Section",
            "pills": ["HI-PASS", "LO-PASS"],
            "active": "HI-PASS",
        },
        "viz_title": "Frequency Spectrum - high-pass active",
        "next_label": "See Example",
        "next_target": 4,
    },
    {
        "id": 4,
        "tab": "examples",
        "title": "Effect Lesson: Echo / Delay",
        "subtitle": "Echo repeats the outgoing sound in rhythmic pulses.",
        "description": "Use short feedback for controlled tails.",
        "best_for": [
            "Dramatic exits from a phrase",
            "Building suspense before a drop",
            "Throwing a vocal hit into space",
        ],
        "tip": "Danger: keep Feedback below 60% to avoid infinite loops.",
        "board": {
            "title": "Delay / Echo Unit",
            "pills": ["1/4 NOTE", "38% FEEDBACK", "DRY/WET"],
            "active": "38% FEEDBACK",
        },
        "viz_title": "Echo tail - each repeat fades by ~40%",
        "next_label": "Compare",
        "next_target": 5,
    },
    {
        "id": 5,
        "tab": "summary",
        "title": "Effect Lesson: Reverb",
        "subtitle": "Reverb simulates sound bouncing off surfaces.",
        "description": "Creates a smooth wide tail for depth and atmosphere.",
        "best_for": [
            "Adding depth and atmosphere",
            "Softening a hard exit",
            "Making a track feel huge",
        ],
        "tip": "Tip: Short room = subtle. Long hall = dramatic.",
        "board": {
            "title": "Reverb Unit",
            "pills": ["ROOM", "HALL", "CAVE", "PLATE"],
            "active": "HALL",
        },
        "viz_title": "Dry signal vs. Reverb on",
        "next_label": "See Quiz",
        "next_target": "quiz",
    },
]

QUIZ: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Quiz: Sort the Steps",
        "instruction": "Pick the correct order for a clean filter transition.",
        "type": "single",
        "choices": [
            "Turn filter high-pass -> bring up Track B -> move crossfader -> release filter",
            "Bring up Track B -> release filter -> crossfader -> high-pass",
            "Crossfader first -> filter sweep -> Track B volume -> release filter",
        ],
        "correct": 0,
    },
    {
        "id": 2,
        "title": "Quiz: True or False",
        "instruction": "Select True/False for each statement.",
        "type": "multi_tf",
        "statements": [
            {
                "prompt": "Echo creates smooth continuous room reflections.",
                "correct": False,
                "explanation": "False. That is Reverb. Echo creates rhythmic repeats.",
            },
            {
                "prompt": "A high-pass filter removes low frequencies.",
                "correct": True,
                "explanation": "True. High-pass lets highs through and cuts lows.",
            },
            {
                "prompt": "Feedback controls how many times Echo repeats.",
                "correct": True,
                "explanation": "True. More feedback gives more repeats.",
            },
            {
                "prompt": "Reverb and Echo produce the same sound result.",
                "correct": False,
                "explanation": "False. Reverb is smooth ambience; echo is distinct repeats.",
            },
        ],
    },
    {
        "id": 3,
        "title": "Quiz: Set the Knob",
        "instruction": "Choose the best setting in each scenario.",
        "type": "scenario_single",
        "scenarios": [
            {
                "name": "Smooth high-pass sweep on outgoing track",
                "choices": ["Off", "25%", "Too far"],
                "correct": 1,
            },
            {
                "name": "Short echo with only two rhythmic repeats",
                "choices": ["Too dry", "38%", "Infinite"],
                "correct": 1,
            },
            {
                "name": "Big hall reverb with lots of space",
                "choices": ["Too short", "Room", "Hall"],
                "correct": 2,
            },
        ],
    },
    {
        "id": 4,
        "title": "Quiz: Read the Faders",
        "instruction": "Pick the mixer state for mid-transition with Filter active on A.",
        "type": "single",
        "choices": [
            "A and B are equal, no filter active",
            "A fading out, B rising, Filter on A",
            "Track A already gone, transition ended",
        ],
        "correct": 1,
    },
]

APP_STATE: dict[str, Any] = {
    "events": [],
    "quiz_answers": {},
    "started_at": None,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def track_event(event_type: str, payload: dict[str, Any] | None = None) -> None:
    APP_STATE["events"].append(
        {
            "timestamp": now_iso(),
            "event": event_type,
            "payload": payload or {},
        }
    )


@app.get("/")
def home() -> str:
    track_event("page_view", {"route": "/"})
    return render_template("home.html")


@app.post("/api/start")
def start_learning() -> Any:
    APP_STATE["started_at"] = now_iso()
    APP_STATE["quiz_answers"] = {}
    track_event("start_learning", {"route": "/"})
    return jsonify({"ok": True, "next": url_for("learn_page", lesson_id=1)})


@app.get("/learn/<int:lesson_id>")
def learn_page(lesson_id: int) -> str:
    lesson = next((item for item in LESSONS if item["id"] == lesson_id), None)
    if lesson is None:
        return redirect(url_for("learn_page", lesson_id=1))

    track_event("page_view", {"route": f"/learn/{lesson_id}", "lesson_id": lesson_id})
    return render_template(
        "learn.html",
        lesson=lesson,
        lesson_id=lesson_id,
        has_prev=lesson_id > 1,
        prev_id=max(1, lesson_id - 1),
        next_id=min(len(LESSONS), lesson_id + 1),
    )


@app.post("/api/track")
def api_track() -> Any:
    payload = request.get_json(silent=True) or {}
    event_type = payload.get("event", "interaction")
    event_payload = payload.get("payload", {})
    track_event(event_type, event_payload)
    return jsonify({"ok": True})


@app.get("/quiz/<int:quiz_id>")
def quiz_page(quiz_id: int) -> str:
    question = next((q for q in QUIZ if q["id"] == quiz_id), None)
    if question is None:
        return redirect(url_for("quiz_results"))

    track_event("page_view", {"route": f"/quiz/{quiz_id}", "quiz_id": quiz_id})
    return render_template(
        "quiz.html",
        question=question,
        quiz_id=quiz_id,
        has_prev=quiz_id > 1,
        next_id=quiz_id + 1,
        is_last=quiz_id == len(QUIZ),
        saved_answer=APP_STATE["quiz_answers"].get(str(quiz_id)),
    )


@app.post("/quiz/<int:quiz_id>")
def submit_quiz(quiz_id: int) -> Any:
    question = next((q for q in QUIZ if q["id"] == quiz_id), None)
    if question is None:
        return redirect(url_for("quiz_results"))
    # Support both traditional form submissions and JSON/AJAX submissions.
    payload: dict[str, Any] = {}
    if request.is_json:
        payload = request.get_json(silent=True) or {}
    else:
        # read from form and normalize into a dict similar to JSON payload
        payload = {k: v for k, v in request.form.items()}

    answer: Any
    if question["type"] == "single":
        answer = payload.get("choice")
    elif question["type"] == "multi_tf":
        answer = [payload.get(f"tf_{idx}") for idx, _ in enumerate(question["statements"]) ]
    else:
        answer = [payload.get(f"scenario_{idx}") for idx, _ in enumerate(question["scenarios"]) ]

    APP_STATE["quiz_answers"][str(quiz_id)] = answer
    track_event(
        "quiz_answer",
        {"quiz_id": quiz_id, "answer": answer},
    )

    # If this is an AJAX/JSON request, respond with immediate feedback about correctness
    next_url = url_for("quiz_results") if quiz_id >= len(QUIZ) else url_for("quiz_page", quiz_id=quiz_id + 1)
    if request.is_json or request.headers.get("X-Requested-With") == "XMLHttpRequest":
        # compute correctness for this single question using same logic as score_quiz
        q = question
        correct = False
        best_answer = ""
        per_item = None

        if q["type"] == "single":
            correct_index = q["correct"]
            best_answer = q["choices"][correct_index]
            correct = str(correct_index) == str(answer)
        elif q["type"] == "multi_tf":
            expected = ["true" if s["correct"] else "false" for s in q["statements"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (answer or [])]
            correct = cleaned == expected
            # build per-statement details
            per_item = []
            for idx, stmt in enumerate(q["statements"]):
                user_val = None
                try:
                    user_val = (answer or [])[idx]
                except Exception:
                    user_val = None
                user_val = "" if user_val is None else user_val
                expected_val = expected[idx]
                is_correct = user_val == expected_val
                per_item.append(
                    {
                        "index": idx,
                        "user": user_val,
                        "expected": expected_val,
                        "correct": is_correct,
                        "explanation": stmt.get("explanation", ""),
                    }
                )
        else:
            expected = [str(s["correct"]) for s in q["scenarios"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (answer or [])]
            correct = cleaned == expected

        resp_payload = {"ok": True, "correct": correct, "best_answer": best_answer, "next": next_url}
        if per_item is not None:
            resp_payload["per_item"] = per_item
        return jsonify(resp_payload)

    # Fallback: regular form submit -> redirect to next page
    if quiz_id >= len(QUIZ):
        return redirect(url_for("quiz_results"))
    return redirect(url_for("quiz_page", quiz_id=quiz_id + 1))



def score_quiz() -> tuple[int, int, list[dict[str, Any]]]:
    total = len(QUIZ)
    score = 0
    details: list[dict[str, Any]] = []

    for q in QUIZ:
        qid = str(q["id"])
        user_answer = APP_STATE["quiz_answers"].get(qid)
        correct = False
        best_answer = ""

        if q["type"] == "single":
            correct_index = q["correct"]
            best_answer = q["choices"][correct_index]
            correct = str(correct_index) == str(user_answer)
        elif q["type"] == "multi_tf":
            expected = ["true" if s["correct"] else "false" for s in q["statements"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            correct = cleaned == expected
        else:
            expected = [str(s["correct"]) for s in q["scenarios"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            correct = cleaned == expected

        if correct:
            score += 1

        details.append(
            {
                "id": q["id"],
                "title": q["title"],
                "correct": correct,
                "user_answer": user_answer,
                "best_answer": best_answer,
            }
        )

    return score, total, details


@app.get("/quiz/results")
def quiz_results() -> str:
    score, total, details = score_quiz()
    track_event("page_view", {"route": "/quiz/results", "score": score, "total": total})
    return render_template(
        "results.html",
        score=score,
        total=total,
        details=details,
        started_at=APP_STATE["started_at"],
        events=APP_STATE["events"],
    )


@app.get("/api/state")
def api_state() -> Any:
    score, total, details = score_quiz()
    return jsonify(
        {
            "started_at": APP_STATE["started_at"],
            "score": score,
            "total": total,
            "answers": APP_STATE["quiz_answers"],
            "details": details,
            "events": APP_STATE["events"],
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
