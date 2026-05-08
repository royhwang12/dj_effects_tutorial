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
                "4. Learn Phaser",
                "5. Compare situations",
                "6. Take the quiz",
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
        "sample": {
            "effect": "echo",
            "label": "Play Echo Sample",
            "hint": "Hear a sharp stab with repeating delay tails.",
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
        "sample": {
            "effect": "reverb",
            "label": "Play Reverb Sample",
            "hint": "Hear a wide ambient tail on a short tone.",
        },
        "viz_title": "Dry signal vs. Reverb on",
        "next_label": "Learn Phaser",
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
        "next_label": "See Quiz",
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
        "correct": 0,
        "hint": "Think: engage a high-pass first, bring in the incoming track, move the crossfader, then release the filter.",
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
        "hint": "Remember: Echo = distinct repeats, Reverb = smooth ambience; read each statement carefully.",
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
        "hint": "Pick the smallest practical knob change for the effect: subtle for smoothing, medium for echo, larger for hall reverb.",
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
        "hint": "If Filter is active on A mid-transition, A will likely be lowering while B rises — look for A fading and B rising.",
    },
    {
        "id": 5,
        "title": "Quiz: Adjust the Filter Knob",
        "instruction": "Adjust the filter cutoff to the best setting to smoothly remove lows (0-100).",
        "type": "slider",
        "min": 0,
        "max": 100,
        "step": 1,
        "default": 30,
        "correct": 28,
        "tolerance": 6,
        "hint": "Try a cutoff near 28 — the correct range is roughly 22–34 for a smooth low removal.",
    },
    {
        "id": 6,
        "title": "Quiz: Set the Tempo",
        "instruction": "Set the tempo (BPM) that matches the example loop for smooth phrasing.",
        "type": "slider",
        "min": 80,
        "max": 140,
        "step": 1,
        "default": 108,
        "correct": 108,
        "tolerance": 3,
        "hint": "Match the loop's BPM — aim for 108 BPM (within ±3 BPM) for smooth phrasing.",
    },
    {
        "id": 7,
        "title": "Quiz: Set the Board",
        "instruction": "Using the diagram, adjust the controls to the right configuration for a smooth filter transition. Move the sliders and toggles, then Submit when you think it's correct.",
        "type": "interactive",
        "diagram": "/static/images/dj_board_diagram.svg",
        "controls": ["crossfader", "filter_a", "filter_b", "echo", "gain_a", "gain_b"],
        "expected": {
            "crossfader": 50,
            "crossfader_tol": 12,
            "filter_a": 25,
            "filter_tol": 8,
            "filter_b": 0,
            "echo": False,
            "gain_diff_tol": 6
        },
        "hint": "Aim for crossfader near center (~50), Filter A around 20–30%, Filter B low, Echo OFF, and gains roughly balanced.",
    },
    {
        "id": 8,
        "title": "Quiz: Match the Disks",
        "instruction": "Turn the two jog wheels (disks) to match the shown levels — set both gains to the target and center the crossfader if instructed.",
        "type": "interactive",
        "diagram": "/static/images/dj_board_diagram.svg",
        "controls": ["crossfader", "filter_a", "filter_b", "echo", "gain_a", "gain_b"],
        "expected": {
            "crossfader": 50,
            "crossfader_tol": 12,
            "filter_a": 30,
            "filter_tol": 8,
            "filter_b": 0,
            "echo": False,
            "gain_a": 60,
            "gain_b": 60,
            "gain_diff_tol": 4
        },
        "hint": "Match the disk levels: both gains ~60%, crossfader near center, Filter A slightly up, Echo OFF.",
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
    elif question["type"] == "filter_percent":
        answer = payload.get("filter_percent")
    else:
        answer = payload.get("choice")
    elif question["type"] == "multi_tf":
        answer = [payload.get(f"tf_{idx}") for idx, _ in enumerate(question["statements"]) ]
    elif question["type"] == "slider":
        val = payload.get("slider") or payload.get("value") or payload.get("slider_value")
        try:
            answer = int(val)
        except Exception:
            answer = None
    elif question["type"] == "interactive":
        # expect named controls from the interactive board
        def to_int(v, default=None):
            try:
                return int(v)
            except Exception:
                return default

        cross = to_int(payload.get("crossfader") or payload.get("crossfader_val"), None)
        filter_a = to_int(payload.get("filter_a"), None)
        filter_b = to_int(payload.get("filter_b"), None)
        echo_raw = payload.get("echo")
        echo = True if str(echo_raw).lower() in ("1","true","on","yes") else False
        gain_a = to_int(payload.get("gain_a"), None)
        gain_b = to_int(payload.get("gain_b"), None)
        answer = {
            "crossfader": cross,
            "filter_a": filter_a,
            "filter_b": filter_b,
            "echo": echo,
            "gain_a": gain_a,
            "gain_b": gain_b,
        }
    else:
        answer = [payload.get(f"scenario_{idx}") for idx, _ in enumerate(question["scenarios"]) ]

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
            "next": (quiz_id + 1) if quiz_id < len(QUIZ) else None,
            "next_url": (url_for("quiz_page", quiz_id=quiz_id + 1) if quiz_id < len(QUIZ) else None),
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
        correct = False
        best_answer = ""

        if q["type"] == "single":
            correct_index = q["correct"]
            best_answer = q["choices"][correct_index]
            correct = str(correct_index) == str(user_answer)
        elif q["type"] == "match_defs":
            expected = [str(idx) for idx in q["correct"]]
            best_answer = ", ".join(
                f"{q['definitions'][i]} -> {q['terms'][q['correct'][i]]}" for i in range(len(q["definitions"]))
            )
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            correct = cleaned == expected
        elif q["type"] == "slider":
            # numeric comparison within tolerance
            try:
                val = int(user_answer) if user_answer is not None else None
            except Exception:
                val = None
            correct_val = q.get("correct")
            tol = q.get("tolerance", 0)
            best_answer = str(correct_val)
            if val is None:
                correct = False
            else:
                correct = abs(val - int(correct_val)) <= int(tol)
        elif q["type"] == "interactive":
            # evaluate numeric tolerances and boolean echo
            exp = q.get("expected", {})
            ia_correct = False
            try:
                if isinstance(user_answer, dict):
                    cross = user_answer.get("crossfader")
                    fa = user_answer.get("filter_a")
                    fb = user_answer.get("filter_b")
                    echo_val = user_answer.get("echo")
                    ga = user_answer.get("gain_a")
                    gb = user_answer.get("gain_b")
                    # tolerance checks
                    cross_ok = (cross is not None and abs(int(cross) - int(exp.get("crossfader", 50))) <= int(exp.get("crossfader_tol", 10)))
                    fa_ok = (fa is not None and abs(int(fa) - int(exp.get("filter_a", 25))) <= int(exp.get("filter_tol", 8)))
                    fb_ok = (fb is not None and abs(int(fb) - int(exp.get("filter_b", 0))) <= int(exp.get("filter_tol", 8)))
                    echo_ok = (bool(echo_val) == bool(exp.get("echo", False)))
                    gain_ok = True
                    # if explicit expected gains provided, compare each to its target
                    if exp.get("gain_a") is not None and exp.get("gain_b") is not None:
                        ga_ok = (ga is not None and abs(int(ga) - int(exp.get("gain_a"))) <= int(exp.get("gain_diff_tol", 6)))
                        gb_ok = (gb is not None and abs(int(gb) - int(exp.get("gain_b"))) <= int(exp.get("gain_diff_tol", 6)))
                        gain_ok = ga_ok and gb_ok
                    else:
                        if ga is not None and gb is not None:
                            gain_ok = abs(int(ga) - int(gb)) <= int(exp.get("gain_diff_tol", 6))
                    ia_correct = cross_ok and fa_ok and fb_ok and echo_ok and gain_ok
                    best_answer = f"cross~{exp.get('crossfader')} filterA~{exp.get('filter_a')} echo~{exp.get('echo')}"
                    correct = ia_correct
                else:
                    correct = False
            except Exception:
                correct = False
        else:
            expected = [str(s["correct"]) for s in q["scenarios"]]
            best_answer = ", ".join(expected)
            cleaned = ["" if x is None else x for x in (user_answer or [])]
            correct = cleaned == expected
        elif q["type"] == "filter_percent":
            try:
                value = int(user_answer) if user_answer is not None else -1
            except ValueError:
                value = -1
            correct = q["target_min"] <= value <= q["target_max"]
            best_answer = f"{q['target_min']}% to {q['target_max']}%"

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
