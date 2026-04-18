import argparse
import gdown
from pathlib import Path

from harmoniq import DEMANDE_PATH

GOOGLE_DRIVE_FILE_ID_SQLITE = "1EA596DXPYxUMKDWa3L9WyKiwzGBW_7aP"
GOOGLE_DRIVE_FILE_ID_POSTGRE = "166moUTKfaNmOlz6YJ-kKvx0w4GS2oxIA"

def download_db(is_sqlite=False):
    if is_sqlite:
        file_id = GOOGLE_DRIVE_FILE_ID_SQLITE
        output_path = str(DEMANDE_PATH)
        print(f"Téléchargement de la base de données SQLite DEMANDE (ID: {file_id}) vers {output_path}...")
    else:
        file_id = GOOGLE_DRIVE_FILE_ID_POSTGRE
        output_path = str(Path(DEMANDE_PATH).parent / "harmoniq.sql")
        print(f"Téléchargement du dump PostgreSQL (ID: {file_id}) vers {output_path}...")

    try:
        gdown.download(id=file_id, output=output_path, quiet=False)
    except Exception as e:
        print(f"Erreur lors du téléchargement ou de la décompression : {e}")
        exit(1)

def main():
    parser = argparse.ArgumentParser(description="Télécharge la base de données")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--postgre", "-p", action="store_true", default=True, help="Télécharge la base de données PostgreSQL (harmoniq.sql)")
    group.add_argument("--sqlite", "-s", action="store_true", help="Télécharge la base de données SQLite (demande.db)")

    args = parser.parse_args()
    
    # If sqlite is passed, it overrides the default postgre behavior
    download_db(is_sqlite=args.sqlite)

if __name__ == "__main__":
    main()
