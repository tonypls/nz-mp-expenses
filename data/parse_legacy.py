import json
import os

filepath = '/Users/tvs/.gemini/antigravity/brain/24b18550-46af-47af-9b36-e4510ba6e649/browser/scratchpad_ofjxziwn.md'
with open(filepath, 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('[{"filename"'):
            data = json.loads(line, strict=False)
            for item in data:
                out_path = os.path.join('data/expenses', item['filename'])
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(item['csv'])
                print(f"Saved {out_path}")
            print("All legacy CSV files saved!")
            break
