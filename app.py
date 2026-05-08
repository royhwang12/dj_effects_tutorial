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
                "Learn Filter",
                "Learn Echo",
                "Learn Reverb",
                "Learn Phaser",
                "Take the quiz",
            ],
        },
        "right_actions": [
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
                "name": "Phaser",
                "summary": "Adds a swirling resonant sweep.",
                "accent": "orange",
                "target": 6,
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
        "sample": {
            "effect": "filter",
            "label": "Play Filter Sample",
            "hint": "Hear a low-cut sweep over a short synth loop.",
        },
        "viz_title": "Frequency Spectrum - high-pass active",
        "next_label": "Next",
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
        "sample": {
            "effect": "echo",
            "label": "Play Echo Sample",
            "hint": "Hear a sharp stab with repeating delay tails.",
        },
        "viz_title": "Echo tail - each repeat fades by ~40%",
        "next_label": "Next",
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
        "sample": {
            "effect": "reverb",
            "label": "Play Reverb Sample",
            "hint": "Hear a wide ambient tail on a short tone.",
        },
        "viz_title": "Dry signal vs. Reverb on",
        "next_label": "Next",
        "next_target": 6,
    },
    {
        "id": 6,
        "tab": "examples",
        "title": "Effect Lesson: Phaser",
        "subtitle": "Phaser sweeps moving notches through the sound for a swirling texture.",
        "description": "Use it for aggressive movement and dramatic tension in transitions.",
        "best_for": [
            "Sweeping builds before drops",
            "Adding movement to static sections",
            "Short dramatic transitions",
        ],
        "tip": "Tip: push the knob higher for a deeper swirl, then pull it back before the drop.",
        "board": {
            "title": "Phaser Unit",
            "pills": ["RATE", "DEPTH", "RESONANCE"],
            "active": "DEPTH",
        },
        "sample": {
            "effect": "phaser",
            "label": "Play Phaser Sample",
            "hint": "Hear a deep swirling phase sweep on a house loop.",
        },
        "viz_title": "Phaser sweep - moving notches shift across the spectrum",
        "next_label": "Next",
        "next_target": "quiz",
    },
]

QUIZ: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Quiz: Match The Definition",
        "instruction": "Match each definition to the correct effect.",
        "type": "match_defs",
        "terms": ["Filter", "Echo", "Reverb", "Phaser"],
        "definitions": [
            "Repeating tail in rhythm",
            "Swirling sweep with moving notches",
            "Removes highs or lows from the signal",
            "Creates a room or hall-like space",
        ],
        "correct": [1, 3, 0, 2],
    },
    {
        "id": 2,
        "title": "Quiz: Identify The Effect By Ear",
        "instruction": "Play each sample on the board and choose the effect.",
        "type": "audio_identify",
        "effects": ["filter", "echo", "reverb", "phaser"],
        "samples": [
            {"id": "a", "label": "Sample A", "effect": "filter"},
            {"id": "b", "label": "Sample B", "effect": "echo"},
            {"id": "c", "label": "Sample C", "effect": "reverb"},
            {"id": "d", "label": "Sample D", "effect": "phaser"},
        ],
    },
    {
        "id": 3,
        "title": "Quiz: Set The Filter Percent",
        "instruction": "Use the DJ board and set the filter amount (%) that best matches the clip.",
        "type": "effect_percent",
        "effect": "filter",
        "effect_label": "Filter",
        "clip_note": "Play the built-in drop clip or upload your own MP3 clip.",
        "target_min": 60,
        "target_max": 80,
    },
    {
        "id": 4,
        "title": "Quiz: Set The Echo Percent",
        "instruction": "Play the clip and set Echo amount (%) to match a medium throw.",
        "type": "effect_percent",
        "effect": "echo",
        "effect_label": "Echo",
        "clip_note": "Use the same source clip and find the amount that sounds like 2-3 clear repeats.",
        "target_min": 40,
        "target_max": 58,
    },
    {
        "id": 5,
        "title": "Quiz: Set The Phaser Percent",
        "instruction": "Play the clip and set Phaser amount (%) to a strong but controlled swirl.",
        "type": "effect_percent",
        "effect": "phaser",
        "effect_label": "Phaser",
        "clip_note": "Aim for a clearly audible swirl without fully washing out the transients.",
        "target_min": 65,
        "target_max": 85,
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
    return jsonify({"ok": True, "next": url_for("learn_page", lesson_id=2)})


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
        total_quizzes=len(QUIZ),
    )


@app.post("/quiz/<int:quiz_id>")
def submit_quiz(quiz_id: int) -> Any:
    question = next((q for q in QUIZ if q["id"] == quiz_id), None)
    if question is None:
        return redirect(url_for("quiz_results"))
    # support traditional form posts and JSON/AJAX posts
    if request.is_json:
        payload = request.get_json(silent=True) or {}
    else:
        payload = {k: v for k, v in request.form.items()}

    answer: Any
    if question["type"] == "match_defs":
        answer = [payload.get(f"match_{idx}") for idx, _ in enumerate(question["definitions"])]
    elif question["type"] == "audio_identify":
        answer = [payload.get(f"sample_{idx}") for idx, _ in enumerate(question["samples"])]
    elif question["type"] == "effect_percent":
        answer = payload.get("effect_percent")
    else:
        answer = payload.get("choice")

    APP_STATE["quiz_answers"][str(quiz_id)] = answer
    track_event(
        "quiz_answer",
        {"quiz_id": quiz_id, "answer": answer},
    )

    # If the client expects JSON (AJAX), return immediate feedback including hint when incorrect
    wants_json = request.is_json or request.headers.get("Accept", "").startswith("application/json")
    if wants_json:
        # compute correctness for this single question
        score, total, details = score_quiz()
        detail = next((d for d in details if d["id"] == quiz_id), None)
        resp = {
            "ok": True,
            "quiz_id": quiz_id,
            "correct": detail["correct"] if detail is not None else False,
            "best_answer": detail["best_answer"] if detail is not None else None,
            "next": (quiz_id + 1) if quiz_id < len(QUIZ) else "results",
            "next_url": (url_for("quiz_page", quiz_id=quiz_id + 1) if quiz_id < len(QUIZ) else url_for("quiz_results")),
        }
        # include hint text if available and the answer was incorrect
        qobj = next((q for q in QUIZ if q["id"] == quiz_id), {})
        if not resp["correct"] and qobj.get("hint"):
            resp["hint"] = qobj["hint"]
        return jsonify(resp)

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
        user_answer_display: Any = user_answer
        correct = False
        best_answer = ""

        if q["type"] == "match_defs":
            expected = [str(idx) for idx in q["correct"]]
            best_answer = ", ".join(
                f"{q['definitions'][i]} -> {q['terms'][q['correct'][i]]}" for i in range(len(q["definitions"]))
            )
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            user_answer_display = [
                q["terms"][int(x)] if str(x).isdigit() and 0 <= int(x) < len(q["terms"]) else (x or "")
                for x in cleaned
            ]
            correct = cleaned == expected
        elif q["type"] == "audio_identify":
            expected = [s["effect"] for s in q["samples"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            correct = cleaned == expected
        elif q["type"] == "effect_percent":
            try:
                value = int(user_answer) if user_answer is not None else -1
            except ValueError:
                value = -1
            correct = q["target_min"] <= value <= q["target_max"]
            best_answer = f"{q['target_min']}% to {q['target_max']}%"
        else:
            best_answer = ""
            correct = False

        if correct:
            score += 1

        details.append(
            {
                "id": q["id"],
                "title": q["title"],
                "correct": correct,
                "user_answer": user_answer_display,
                "best_answer": best_answer,
            }
        )

    return score, total, details


def first_unanswered_quiz_id() -> int | None:
    for q in QUIZ:
        qid = str(q["id"])
        if qid not in APP_STATE["quiz_answers"]:
            return q["id"]
    return None


@app.get("/quiz/results")
def quiz_results() -> str:
    unanswered = first_unanswered_quiz_id()
    if unanswered is not None:
        return redirect(url_for("quiz_page", quiz_id=unanswered))

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
    app.run(debug=True, port=5001)
