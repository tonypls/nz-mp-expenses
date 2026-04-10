import pandas as pd
import os
import json

def analyze_file(path):
    try:
        # Load the file
        if path.endswith('.csv'):
            df = pd.read_csv(path, header=None)
        else:
            df = pd.read_excel(path, header=None, engine='openpyxl' if path.endswith('.xlsx') else 'xlrd')
        
        # Try to find the header row by looking for 'Party' or 'Member'
        header_row_idx = -1
        for i in range(min(10, len(df))):
            row_values = [str(x).strip().lower() for x in df.iloc[i].fillna('')]
            if any(k in row_values for k in ['party', 'parties']) and any('member' in k or 'name' in k or 'minister' in k for k in row_values):
                header_row_idx = i
                break
        
        if header_row_idx != -1:
            headers = [str(x).strip().replace('\n', ' ') for x in df.iloc[header_row_idx].fillna('')]
            first_data_row = [str(x).strip() for x in df.iloc[header_row_idx+1].fillna('')]
            return {
                'file': os.path.basename(path),
                'header_row_idx': header_row_idx,
                'headers': headers,
                'sample': first_data_row
            }
        else:
            return {
                'file': os.path.basename(path),
                'header_row_idx': -1,
                'headers': [str(x) for x in df.iloc[0].fillna('')],
                'sample': [str(x) for x in df.iloc[1].fillna('')] if len(df) > 1 else []
            }
    except Exception as e:
        return {'file': os.path.basename(path), 'error': str(e)}

results = []
for folder in ['expenses', 'expenses_ministers']:
    folder_path = os.path.join('/Users/tvs/Code/NZ-MP-Expenses/data', folder)
    if os.path.exists(folder_path):
        files = os.listdir(folder_path)
        # Sample early, mid, late years
        sample_files = [f for f in files if f.startswith('2009')] + \
                       [f for f in files if f.startswith('2015')] + \
                       [f for f in files if f.startswith('2024')]
        for f in sample_files[:6]: # limit to a few
            res = analyze_file(os.path.join(folder_path, f))
            res['type'] = folder
            results.append(res)

print(json.dumps(results, indent=2))
