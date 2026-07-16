#!/usr/bin/env python3
"""Prepare seed batch execution manifest for MCP execute_sql."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCHES = json.loads((ROOT / "batch_index.json").read_text())
CHUNKS = ROOT / "prisma" / "seed_chunks"
OUT = ROOT / "seed_exec" / "manifest.json"

manifest = {
    "project_id": "otgvziyacokdmiwxmnxl",
    "chunks": {},
    "batches": [],
}

for i in range(18):
    name = f"{i:02d}"
    path = CHUNKS / f"{name}.sql"
    manifest["chunks"][name] = {
        "file": str(path),
        "bytes": path.stat().st_size,
    }

for batch in BATCHES:
    path = ROOT / "seed_batches" / batch
    chunk = batch.split("_")[0]
    manifest["batches"].append({
        "name": batch,
        "chunk": chunk,
        "file": str(path),
        "bytes": path.stat().st_size,
    })

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(manifest, indent=2))
print(f"Wrote {OUT} ({len(manifest['batches'])} batches)")
