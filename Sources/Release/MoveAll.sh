#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Process all directories in current location
for dir in */; do
    if [ -d "$dir" ]; then
        echo "Processing: $dir"
        
        # Move all contents from directory to script directory
        mv "$dir"* "$SCRIPT_DIR/" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "Contents moved from: $dir"
            
            # Delete the now-empty directory
            rmdir "$dir" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "Deleted directory: $dir"
            else
                echo "Warning: Could not delete $dir"
            fi
        else
            echo "Warning: Failed to move contents from $dir (might be empty)"
        fi
        echo ""
    fi
done

echo "Processing complete!"