import gdown

from harmoniq import DEMANDE_PATH
GOOGLE_DRIVE_FILE_ID = "1AChv-YwvDrE-nlYdT_aRSumKc571Cqxk"


def download_db():
    print(f"Téléchargement de la base de données (ID: {GOOGLE_DRIVE_FILE_ID})...")
    try:
        file_id = "1AChv-YwvDrE-nlYdT_aRSumKc571Cqxk"
        gdown.download(id=file_id, output=str(DEMANDE_PATH), quiet=False)
    except Exception as e:
        print(f"Erreur lors du téléchargement ou de la décompression : {e}")
        exit(1)

def main():
    download_db()

if __name__ == "__main__":
    main()
