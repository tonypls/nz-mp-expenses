import os
import re

directory = 'data/expenses'
files = os.listdir(directory)

quarters = {
    'january': 'Q1',
    'april': 'Q2',
    'july': 'Q3',
    'october': 'Q4',
    '-q1': 'Q1',
    '-q2': 'Q2',
    '-q3': 'Q3',
    '-q4': 'Q4'
}

for filename in files:
    ext = os.path.splitext(filename)[1]
    if ext in ['.xls', '.xlsx', '.csv']:
        name_lower = filename.lower()
        
        if re.match(r'^20\d\d-Q[1-4]\.(xls|xlsx|csv)$', filename):
            continue # already formatted
            
        quarter = None
        for key, q in quarters.items():
            if key in name_lower:
                quarter = q
                break
                
        year_match = re.findall(r'(20\d{2})', name_lower)
        
        if quarter and year_match:
            # use the first year match usually
            year = year_match[0]
            new_name = f"{year}-{quarter}{ext}"
            
            old_path = os.path.join(directory, filename)
            new_path = os.path.join(directory, new_name)
            
            print(f"Renaming {filename} -> {new_name}")
            os.rename(old_path, new_path)
        else:
            print(f"Skipping {filename}")
