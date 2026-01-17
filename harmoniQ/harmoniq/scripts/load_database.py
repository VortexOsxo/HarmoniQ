from pathlib import Path
import zipfile
import requests

from harmoniq import DB_PATH

LOCAL_DB_DIR = Path(__file__).resolve().parents[1] / "db"
GOOGLE_DRIVE_FILE_ID = "1AChv-YwvDrE-nlYdT_aRSumKc571Cqxk"


def download_db_file_from_google_drive(file_id, destination):
    url = "https://docs.google.com/uc?export=download"
    session = requests.Session()

    response = session.get(url, params={"id": file_id}, stream=True)
    
    token = None
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            token = value
            break

    if token:
        params = {"id": file_id, "confirm": token}
        response = session.get(url, params=params, stream=True)

    if response.status_code != 200:
        raise Exception(f"Erreur lors de la requête Google Drive: Status {response.status_code}")

    CHUNK_SIZE = 2**15
    with open(destination, "wb") as f:
        for chunk in response.iter_content(CHUNK_SIZE):
            if chunk:
                f.write(chunk)


def download_db():
    print(f"Téléchargement de la base de données (ID: {GOOGLE_DRIVE_FILE_ID})...")
    try:
        download_db_file_from_google_drive(GOOGLE_DRIVE_FILE_ID, DB_PATH)
        
        print("Téléchargement terminé, décompression de la base de données...")
        try:
            with zipfile.ZipFile(DB_PATH, "r") as zip_ref:
                zip_ref.testzip()
                zip_ref.extractall(LOCAL_DB_DIR)
        except zipfile.BadZipFile:
            raise Exception("Le fichier téléchargé n'est pas une archive ZIP valide")
        
        print("Décompression terminée, base de données prête à l'emploi.")
    except Exception as e:
        print(f"Erreur lors du téléchargement ou de la décompression : {e}")
        exit(1)

def main():
    download_db()

if __name__ == "__main__":
    main()
