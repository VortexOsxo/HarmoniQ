import re
import json

try:
    with open('hq.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Extract images like /themes/production/images/centrales/name.jpg
    # The links might be relative or absolute path
    links = set(re.findall(r'(/themes/production/images/centrales/[^\"\']+)', html))
    
    mapping = []
    for link in links:
        url = "https://www.hydroquebec.com" + link
        # Extract the base name (e.g., beauharnois)
        match = re.search(r'/([^/]+)-\d+\.jpg$', link)
        if match:
            name = match.group(1)
            mapping.append({"name": name, "url": url})
        else:
            # Maybe it doesn't have a dash number
            match = re.search(r'/([^/]+)\.jpg$', link)
            if match:
                name = match.group(1)
                mapping.append({"name": name, "url": url})

    with open('hq_images.json', 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)
    print(f"Extracted {len(mapping)} images")
except Exception as e:
    print("Error:", e)
