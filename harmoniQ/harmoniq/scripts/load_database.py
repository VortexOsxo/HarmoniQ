import gdown

from harmoniq import DEMANDE_PATH
GOOGLE_DRIVE_FILE_ID = "1EA596DXPYxUMKDWa3L9WyKiwzGBW_7aP"


def download_db():
    print(f"Téléchargement de la base de données (ID: {GOOGLE_DRIVE_FILE_ID})...")
    try:
        gdown.download(id=GOOGLE_DRIVE_FILE_ID, output=str(DEMANDE_PATH), quiet=False)
    except Exception as e:
        print(f"Erreur lors du téléchargement ou de la décompression : {e}")
        exit(1)

def main():
    download_db()

if __name__ == "__main__":
    main()
