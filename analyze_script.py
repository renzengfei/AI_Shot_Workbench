import json
import re
import sys

file_path = "/Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/workspaces/7/deconstruction.json"

try:
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Try to parse the whole file as JSON first
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # If that fails, try to find JSON block
        match = re.search(r'```json\n(.*?)\n```', content, re.DOTALL)
        if match:
            json_str = match.group(1)
            data = json.loads(json_str)
        else:
            raise ValueError("Could not find valid JSON in file")

    # Access shots in round2 -> shots
    shots = data.get('round2', {}).get('shots', [])
    if not shots:
        # Fallback to deconstruction -> shots if structure is different
        shots = data.get('deconstruction', {}).get('shots', [])

    print(f"Total Shots: {len(shots)}")
    print("-" * 40)
    
    for shot in shots:
        duration_str = str(shot.get('duration', '0')).replace('s', '')
        try:
            duration = float(duration_str)
        except ValueError:
            duration = 0.0
        
        print(f"ID: {shot.get('id')}")
        print(f"Duration: {duration}s")
        print(f"Mission: {shot.get('mission')}")
        print(f"Visual: {shot.get('visual_changes')}")
        print(f"Viral Element: {shot.get('viral_element')}")
        print("-" * 20)

except Exception as e:
    print(f"Error: {e}")
