#!/bin/bash

# Change directory to data/expenses relative to where the script is run
cd data/expenses || exit 1

echo "Starting downloads from mp_expense_links.txt..."

# Read URLs from the file in the parent data directory
while IFS= read -r url; do
    if [[ -n "$url" ]]; then
        filename=$(basename "$url")
        echo "Downloading $filename..."
        # Optional: you could add `-A "Mozilla/5.0"` or `--retry 3`
        curl -s -A "Mozilla/5.0" -O "$url"
    fi
done < ../mp_expense_links.txt

echo "All downloads completed."
