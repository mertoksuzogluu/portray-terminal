#!/usr/bin/env python3
"""Print MCP execute_sql arguments for a seed chunk (for agent use)."""
import json
import sys

def main():
    if len(sys.argv) != 2:
        print("Usage: apply_seed_chunk.py NN", file=sys.stderr)
        sys.exit(1)
    n = int(sys.argv[1])
    path = f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.mcp_payload_{n:02d}.json"
    with open(path) as f:
        args = json.load(f)
    out = f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.mcp_invoke_current.json"
    with open(out, "w") as f:
        json.dump(args, f)
    print(json.dumps({"chunk": n, "query_len": len(args["query"]), "invoke_file": out}))

if __name__ == "__main__":
    main()
