#!/usr/bin/env python3
"""Helper: list remaining batches and record results. MCP execute_sql called externally."""
import json
import os
import sys
from datetime import datetime, timezone

EXEC_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(EXEC_DIR)
BATCH_INDEX = os.path.join(PROJECT_ROOT, "batch_index.json")
RESULTS_FILE = os.path.join(EXEC_DIR, "batch_results.json")

DONE_DEFAULT = [
    "01_000.sql", "01_001.sql", "01_002.sql", "01_003.sql", "01_004.sql",
    "02_000.sql", "02_001.sql", "02_002.sql",
]


def load_state():
    if os.path.exists(RESULTS_FILE):
        return json.load(open(RESULTS_FILE))
    return {"batches": {}, "errors": []}


def save_state(state):
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    json.dump(state, open(RESULTS_FILE, "w"), indent=2)


def remaining_batches(state):
    batches = json.load(open(BATCH_INDEX))
    done = set(DONE_DEFAULT)
    for name, info in state.get("batches", {}).items():
        if info.get("status") == "OK":
            done.add(name if name.endswith(".sql") else f"{name}.sql")
    return [b for b in batches if b not in done]


def get_payload(batch_name):
    name = batch_name.replace(".sql", "")
    path = os.path.join(EXEC_DIR, f"payload_{name}.json")
    return json.load(open(path))


def cmd_list():
    state = load_state()
    rem = remaining_batches(state)
    print(json.dumps({"remaining": rem, "count": len(rem)}))


def cmd_next():
    state = load_state()
    rem = remaining_batches(state)
    if not rem:
        print(json.dumps({"done": True}))
        return
    batch = rem[0]
    payload = get_payload(batch)
    print(json.dumps({
        "batch": batch,
        "project_id": payload["project_id"],
        "query": payload["query"],
        "remaining": len(rem),
    }))


def cmd_record(batch, status, error=None):
    state = load_state()
    key = batch.replace(".sql", "")
    state.setdefault("batches", {})[key] = {"status": status, "error": error}
    if status == "FAIL" and error:
        state.setdefault("errors", []).append({"batch": key, "error": error})
    save_state(state)
    print(json.dumps({"recorded": key, "status": status}))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        cmd_list()
    elif cmd == "next":
        cmd_next()
    elif cmd == "record":
        cmd_record(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    else:
        print("usage: run_all_batches.py [list|next|record BATCH STATUS [ERROR]]")
