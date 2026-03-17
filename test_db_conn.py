import psycopg2
import sys

try:
    conn = psycopg2.connect(
        dbname="famwell",
        user="postgres",
        password="karn",
        host="localhost",
        port="5432"
    )
    print("SUCCESS: Connected to database 'famwell' on localhost")
    cur = conn.cursor()
    cur.execute("SELECT version();")
    print(f"Version: {cur.fetchone()[0]}")
    conn.close()
except Exception as e:
    print(f"FAILURE: Could not connect to database on localhost. Error: {e}")

print("-" * 20)

try:
    conn = psycopg2.connect(
        dbname="famwell",
        user="postgres",
        password="karn",
        host="127.0.0.1",
        port="5432"
    )
    print("SUCCESS: Connected to database 'famwell' on 127.0.0.1")
    conn.close()
except Exception as e:
    print(f"FAILURE: Could not connect to database on 127.0.0.1. Error: {e}")
