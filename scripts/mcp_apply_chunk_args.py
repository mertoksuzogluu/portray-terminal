#!/usr/bin/env python3
"""Print MCP execute_sql arguments JSON for chunk NN (stdout)."""
import json
import sys

def main():
    n = int(sys.argv[1])
    path = f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.mcp_invoke_{n:02d}.json"
    with open(path) as f:
        print(f.read())

if __name__ == "__main__":
    main()
