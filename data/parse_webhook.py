import json
import os

filepath = 'data/webhook_requests.json'
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)
    
if 'data' not in data:
    print("No data found in webhook response")
    exit(1)

requests_list = data['data']
print(f"Found {len(requests_list)} requests in webhook payload")

for idx, req in enumerate(requests_list):
    content = req.get('content')
    if not content:
        continue
    try:
        # The content might be a JSON string since we used text/plain with JSON.stringify payload
        payload = json.loads(content)
        filename = payload.get('filename')
        csv_data = payload.get('csv')
        
        if filename and csv_data:
            out_path = os.path.join('data/expenses', filename)
            with open(out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(csv_data)
            print(f"Saved {out_path}")
        else:
            print(f"Missing filename or csv_data in content of request {idx}")
    except json.JSONDecodeError:
        print(f"Request {idx} content is not JSON.")
print("Done parsing webhook requests.")
