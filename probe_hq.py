import pandas as pd
import requests
import unicodedata
import re
import json

def format_name(nom):
    if not isinstance(nom, str): return ""
    nom = unicodedata.normalize('NFD', nom).encode('ascii', 'ignore').decode('utf-8')
    nom = nom.lower()
    nom = re.sub(r'[^a-z0-9]+', '-', nom)
    return nom.strip('-')

csv_files = [
    'harmoniQ/harmoniq/db/CSVs/Info_Barrages.csv',
    'harmoniQ/harmoniq/db/CSVs/centrale_thermique.csv',
    'harmoniQ/harmoniq/db/CSVs/centrales_solaires.csv'
]

names = set()

for f in csv_files:
    try:
        df = pd.read_csv(f, delimiter=',' if 'Info_' in f else ';')
        col = 'Nom' if 'Nom' in df.columns else 'nom'
        for n in df[col].dropna():
            names.add(format_name(n))
    except Exception as e:
        print(f"Error reading {f}: {e}")

try:
    df = pd.read_excel('harmoniQ/harmoniq/db/CSVs/Wind_Turbine_Database_FGP.xlsx')
    for n in df['Project Name'].dropna():
         names.add(format_name(n))
except Exception as e:
    print("Error reading excel:", e)

print(f"Found {len(names)} unique infrastructure names.")

valid_urls = []
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
session = requests.Session()
session.verify = False 

for name in names:
    if not name: continue
    url = f"https://www.hydroquebec.com/themes/production/images/centrales/{name}-01.jpg"
    try:
        resp = session.head(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        if resp.status_code == 200:
            valid_urls.append(url)
            print(f"FOUND: {url}")
            continue
        
        url2 = f"https://www.hydroquebec.com/themes/production/images/centrales/{name}.jpg"
        resp2 = session.head(url2, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        if resp2.status_code == 200:
            valid_urls.append(url2)
            print(f"FOUND: {url2}")
            continue

        # Try without accents and spaces but maybe differently?
    except Exception as e:
        pass

# Append known
try:
    with open('hq_images_raw.json', 'r') as f:
        existing = json.load(f)
        for eUrl in existing:
            full = "https://www.hydroquebec.com" + eUrl
            if full not in valid_urls:
                valid_urls.append(full)
except:
    pass

with open('client/src/app/data/hq-images.data.ts', 'w', encoding='utf-8') as f:
    f.write("export const HQ_IMAGE_URLS: string[] = [\n")
    for u in valid_urls:
        f.write(f"  '{u}',\n")
    f.write("];\n")

print(f"Total valid URLs saved: {len(valid_urls)}")
