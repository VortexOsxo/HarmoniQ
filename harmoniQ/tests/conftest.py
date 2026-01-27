import os
from pathlib import Path

os.environ["HARMONIQ_TESTING"] = "True"

TEST_DB_PATH = Path(__file__).resolve().parents[1] / "harmoniq" / "db" / "test_db.sqlite"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()