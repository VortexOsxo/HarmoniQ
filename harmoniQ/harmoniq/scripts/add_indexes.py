"""
Script to add indexes to demande.db for faster query performance.

This is a one-time operation that will:
1. Add index on Demande(meta_id, date) for JOINs and date filtering
2. Add index on Metadata(CUID, weather, scenario) for WHERE clause filtering

"""

import sqlite3
import time
from pathlib import Path

from harmoniq import DEMANDE_PATH


def check_existing_indexes(conn: sqlite3.Connection) -> list:
    """Check which indexes already exist."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
    return [row[0] for row in cursor.fetchall()]


def add_indexes(db_path: Path = DEMANDE_PATH):
    """Add performance indexes to demande.db."""
    
    print(f"Opening database: {db_path}")
    print(f"Database size: {db_path.stat().st_size / (1024**3):.2f} GB")
    
    conn = sqlite3.connect(str(db_path))
    
    # Check existing indexes
    existing = check_existing_indexes(conn)
    print(f"Existing indexes: {existing}")
    
    indexes_to_create = [
        {
            "name": "idx_demande_meta_date",
            "sql": "CREATE INDEX IF NOT EXISTS idx_demande_meta_date ON Demande(meta_id, date)",
            "description": "Index for JOIN on meta_id and date filtering"
        },
        {
            "name": "idx_metadata_lookup", 
            "sql": "CREATE INDEX IF NOT EXISTS idx_metadata_lookup ON Metadata(CUID, weather, scenario)",
            "description": "Index for filtering on CUID, weather, and scenario"
        },
        {
            "name": "idx_demande_date",
            "sql": "CREATE INDEX IF NOT EXISTS idx_demande_date ON Demande(date)",
            "description": "Index for date range queries"
        }
    ]
    
    for idx in indexes_to_create:
        if idx["name"] in existing:
            print(f"✓ Index '{idx['name']}' already exists, skipping")
            continue
            
        print(f"\nCreating index: {idx['name']}")
        print(f"  Purpose: {idx['description']}")
        print(f"  This may take several minutes for 83M rows...")
        
        start_time = time.time()
        try:
            conn.execute(idx["sql"])
            conn.commit()
            elapsed = time.time() - start_time
            print(f"  ✓ Created in {elapsed:.1f} seconds")
        except Exception as e:
            print(f"  ✗ Error: {e}")
    
    # Analyze tables for query optimizer
    print("\nRunning ANALYZE to update query planner statistics...")
    conn.execute("ANALYZE")
    conn.commit()
    
    # Verify indexes
    print("\n=== Final Index List ===")
    final_indexes = check_existing_indexes(conn)
    for idx in final_indexes:
        print(f"  • {idx}")
    
    conn.close()


def verify_improvement(db_path: Path = DEMANDE_PATH):
    """Test query performance after indexing."""
    
    print("\n=== Query Performance Test ===")
    conn = sqlite3.connect(str(db_path))
    
    query = """
        SELECT m.sector, SUM(d.electricity) AS total_electricity, SUM(d.gaz) AS total_gaz
        FROM Demande d
        JOIN Metadata m ON d.meta_id = m.id
        WHERE m.CUID = 1
        AND m.weather = 'typical'
        AND m.scenario = 'PV'
        AND d.date BETWEEN '2035-01-01' AND '2035-12-31'
        GROUP BY m.sector
    """
    
    # Check query plan
    print("\nQuery plan:")
    cursor = conn.cursor()
    cursor.execute(f"EXPLAIN QUERY PLAN {query}")
    for row in cursor.fetchall():
        print(f"  {row}")
    
    # Time the query
    print("\nExecuting query...")
    start = time.time()
    cursor.execute(query)
    results = cursor.fetchall()
    elapsed = time.time() - start
    
    print(f"Query completed in {elapsed:.2f} seconds")
    print(f"Results: {len(results)} sectors")
    
    conn.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Add indexes to demande.db")
    parser.add_argument("--verify", action="store_true", help="Only verify/test query performance")
    args = parser.parse_args()
    
    if args.verify:
        verify_improvement()
    else:
        add_indexes()
        verify_improvement()
