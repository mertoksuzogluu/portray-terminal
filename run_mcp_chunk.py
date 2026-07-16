import json, sys
for i in range(int(sys.argv[1]), int(sys.argv[2])+1):
    q=open(f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/.seed_q_{i:02d}.txt").read()
    json.dump({"chunk":f"{i:02d}","project_id":"otgvziyacokdmiwxmnxl","query":q}, open(f"/Users/mertoksuzoglu/Desktop/yatirim-portfoyu/mcp_payload_{i:02d}.json","w"))
    print(i, len(q))
