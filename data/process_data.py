import os
import json
import pandas as pd
import re
import math

KNOWN_PARTIES = {
    'act': 'ACT', 'act new zealand': 'ACT', 
    'green': 'Green', 'greens': 'Green', 'green party': 'Green',
    'national': 'National', 'labour': 'Labour',
    'nz first': 'NZ First', 'new zealand first': 'NZ First', 'n z first': 'NZ First',
    'te pati maori': 'Te Pāti Māori', 'maori': 'Te Pāti Māori', 'māori': 'Te Pāti Māori', 'maori party': 'Te Pāti Māori',
    'united future': 'United Future', 'mana': 'Mana', 'mana party': 'Mana',
    'progressive': 'Progressive', 'alliance': 'Alliance', 
    'independent': 'Independent', 'speaker': 'Speaker'
}

def normalize_party(party):
    p = str(party).strip().lower()
    for k, v in KNOWN_PARTIES.items():
        if p.startswith(k) or p == k:
            return v
    return 'Unknown'

def clean_currency(val):
    if pd.isna(val):
        return 0.0
    s = str(val).lower().strip()
    if s in ['-', 'nil', 'null', 'nan', 'na', '']:
        return 0.0
    s = re.sub(r'[^\d\.\-]', '', s)
    try:
        return float(s)
    except ValueError:
        return 0.0

def process_file(path, year, quarter, is_minister=False):
    try:
        if path.endswith('.csv'):
            df = pd.read_csv(path, header=None)
        else:
            try:
                df = pd.read_excel(path, header=None, engine='openpyxl' if path.endswith('.xlsx') else 'xlrd')
            except Exception as e:
                if 'Expected BOF' in str(e):
                    dfs = pd.read_html(path)
                    df = dfs[0]
                else:
                    raise e
                    
        records = []
        
        # Step 1: Find header row to dynamically determine column indexes
        header_row_idx = -1
        # Merge the first few rows to a "super header" to find column meanings
        col_mappings = {
            'party': -1,
            'name': -1,
            'wellington': -1,
            'other': -1,
            'air': -1,
            'surface': -1,
            'international': -1
        }
        
        for i in range(min(10, len(df))):
            row_vals = [str(x).lower().strip() for x in df.iloc[i].fillna('')]
            if any('party' in x or 'parties' in x for x in row_vals) and any('member' in x or 'name' in x or 'minister' in x for x in row_vals):
                header_row_idx = i
                break
                
        if header_row_idx == -1:
            print(f"[{path}] Could not find header row. Falling back to default.")
            # Default fallback mapping
            col_mappings = {'party': 0, 'name': 1, 'wellington': 2, 'other': 3, 'air': 4, 'surface': 5, 'international': 7}
        else:
            # We want to scan the header row AND the row directly underneath to build our map
            row1 = [str(x).lower().strip() for x in df.iloc[header_row_idx].fillna('')]
            row2 = [str(x).lower().strip() for x in df.iloc[header_row_idx+1].fillna('')] if header_row_idx+1 < len(df) else []
            
            for c in range(len(df.columns)):
                cell = row1[c] if c < len(row1) else ''
                cell2 = row2[c] if c < len(row2) else ''
                val = cell + ' ' + cell2
                
                if 'party' in val and col_mappings['party'] == -1: col_mappings['party'] = c
                elif ('minister' in val or 'member' in val or 'name' in val) and col_mappings['name'] == -1: col_mappings['name'] = c
                elif 'wellington' in val and ('out of' not in val and 'non' not in val) and col_mappings['wellington'] == -1: col_mappings['wellington'] = c
                elif ('out of wellington' in val or 'non wellington' in val) and col_mappings['other'] == -1: col_mappings['other'] = c
                elif 'air' in val and col_mappings['air'] == -1: col_mappings['air'] = c
                elif 'surface' in val and col_mappings['surface'] == -1: col_mappings['surface'] = c
                elif 'international' in val and col_mappings['international'] == -1: col_mappings['international'] = c

            # Fallback if any is missing
            if col_mappings['party'] == -1: col_mappings['party'] = 0
            if col_mappings['name'] == -1: col_mappings['name'] = 1
            if col_mappings['wellington'] == -1: col_mappings['wellington'] = 2
            if col_mappings['other'] == -1: col_mappings['other'] = 3
            if col_mappings['air'] == -1: col_mappings['air'] = 4
            if col_mappings['surface'] == -1: col_mappings['surface'] = 5
            if col_mappings['international'] == -1: col_mappings['international'] = 7
        
        current_party = 'Unknown'
        for i in range(len(df)):
            if i <= header_row_idx + 1:
                continue # skip header rows
                
            row = [str(x).strip() for x in df.iloc[i].fillna('')]
            if len(row) <= max(col_mappings['wellington'], col_mappings['air']):
                continue
            
            p = row[col_mappings['party']]
            if p:
                current_party = normalize_party(p)
                
            # If no party is explicitly specified and we don't have a tracked one, keep going.
            if not p and current_party == 'Unknown':
                continue
                
            norm_party = current_party
            if norm_party != 'Unknown' or p.lower().startswith('ind'): # Basic check that it is a data row
                name = row[col_mappings['name']].title()
                if not name or 'total' in name.lower() or 'party' in name.lower():
                    continue

                well = clean_currency(row[col_mappings['wellington']])
                other = clean_currency(row[col_mappings['other']])
                air = clean_currency(row[col_mappings['air']])
                surf = clean_currency(row[col_mappings['surface']])
                
                record = {
                    'year': year,
                    'quarter': quarter,
                    'party': norm_party,
                    'name': name,
                    'wellington_accommodation': well,
                    'other_accommodation': other,
                    'domestic_air_travel': air,
                    'surface_travel': surf,
                    'total': well + other + air + surf
                }
                
                if is_minister:
                    intl = 0.0
                    if col_mappings['international'] < len(row):
                        intl = clean_currency(row[col_mappings['international']])
                    record['international_travel'] = intl
                    record['total'] += intl
                    record['is_minister'] = True
                    
                records.append(record)
                
        return records
    except Exception as e:
        print(f"Error processing {path}: {e}")
        return []

def main():
    base_dir = '/Users/tvs/Code/NZ-MP-Expenses/data'
    expenses_dir = os.path.join(base_dir, 'expenses')
    ministers_dir = os.path.join(base_dir, 'expenses_ministers')
    
    mp_data = []
    minister_data = []
    
    for f in os.listdir(expenses_dir):
        if not f.startswith('.'):
            # parse year and quarter from YYYY-QX
            match = re.search(r'(\d{4})-(Q\d)', f)
            if match:
                y = int(match.group(1))
                q = match.group(2)
                mp_data.extend(process_file(os.path.join(expenses_dir, f), y, q, False))
                
    for f in os.listdir(ministers_dir):
        if not f.startswith('.'):
            match = re.search(r'(\d{4})-(Q\d)', f)
            if match:
                y = int(match.group(1))
                q = match.group(2)
                minister_data.extend(process_file(os.path.join(ministers_dir, f), y, q, True))

    out_dir = os.path.join(base_dir, 'processed')
    os.makedirs(out_dir, exist_ok=True)
    
    with open(os.path.join(out_dir, 'mp_expenses.json'), 'w') as f:
        json.dump(mp_data, f, indent=2)
        
    with open(os.path.join(out_dir, 'minister_expenses.json'), 'w') as f:
        json.dump(minister_data, f, indent=2)
        
    print(f"Successfully processed {len(mp_data)} MP records and {len(minister_data)} Minister records.")

if __name__ == "__main__":
    main()
