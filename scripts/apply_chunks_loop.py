#!/usr/bin/env python3
"""Load chunk invoke args for sequential MCP apply (chunks 09-17)."""
import json
import sys

def load_chunk(n: int) -> dict:
    path = f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.mcp_invoke_{n:02d}.json"
    with open(path) as f:
        return json.load(f)

def main():
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 9
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 17
    for n in range(start, end + 1):
        args = load_chunk(n)
        out = f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.mcp_current_{n:02d}.json"
        with open(out, "w") as f:
            json.dump(args, f)
        print(f"chunk {n:02d}: ready ({len(args['query'])} bytes) -> {out}")

if __name__ == "__main__":
    main()
