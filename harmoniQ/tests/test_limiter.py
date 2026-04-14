import pytest
import time
from fastapi.testclient import TestClient
from harmoniq.webserver import app
from harmoniq.webserver import limiter

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_limiter():
    orig_ip_limit = limiter.IP_LIMIT
    orig_server_limit = limiter.SERVER_LIMIT
    
    limiter.IP_LIMIT = 3
    limiter.SERVER_LIMIT = 5
    
    limiter.GLOBAL_HISTORY.clear()
    limiter.IP_HISTORY.clear()
    
    yield
    
    limiter.IP_LIMIT = orig_ip_limit
    limiter.SERVER_LIMIT = orig_server_limit

def test_ip_rate_limiting():
    for _ in range(3):
        response = client.get("/api/ping")
        assert response.status_code == 200
    
    response = client.get("/api/ping")
    assert response.status_code == 429
    assert "Too many requests from IP" in response.json()["detail"]

def test_global_server_rate_limiting():
    limiter.IP_LIMIT = 10 
    
    for _ in range(5):
        response = client.get("/api/ping")
        assert response.status_code == 200
        
    response = client.get("/api/ping")
    assert response.status_code == 429
    assert "Collective request limit reached" in response.json()["detail"]

def test_non_api_routes_not_limited():
    from harmoniq.webserver import ANGULAR_INDEX
    if not ANGULAR_INDEX.exists():
        pytest.skip("Angular client not built")
        
    for _ in range(10):
        response = client.get("/")
        assert response.status_code == 200

def test_inside_rate_limit_does_not_block():
    for _ in range(3):
        assert client.get("/api/ping").status_code == 200

def test_rate_limit_resets_after_window():
    orig_window = limiter.LIMIT_WINDOW
    limiter.LIMIT_WINDOW = 0.5
    
    try:
        for _ in range(3):
            assert client.get("/api/ping").status_code == 200
            
        assert client.get("/api/ping").status_code == 429
        
        time.sleep(0.5)
        
        assert client.get("/api/ping").status_code == 200
        
    finally:
        limiter.LIMIT_WINDOW = orig_window

def test_sliding_window_behavior():
    orig_window = limiter.LIMIT_WINDOW
    limiter.LIMIT_WINDOW = 1.0
    limiter.IP_LIMIT = 2
    
    try:
        assert client.get("/api/ping").status_code == 200
        
        time.sleep(0.6)
        assert client.get("/api/ping").status_code == 200
        assert client.get("/api/ping").status_code == 429
        
        time.sleep(0.5)
        
        assert client.get("/api/ping").status_code == 200
        assert client.get("/api/ping").status_code == 429
        
    finally:
        limiter.LIMIT_WINDOW = orig_window

def test_multi_user_isolation(monkeypatch):
    limiter.IP_LIMIT = 2
    
    monkeypatch.setattr(limiter, "get_client_ip", lambda _: "1.1.1.1")
    assert client.get("/api/ping").status_code == 200
    assert client.get("/api/ping").status_code == 200
    assert client.get("/api/ping").status_code == 429
    
    monkeypatch.setattr(limiter, "get_client_ip", lambda _: "2.2.2.2")
    assert client.get("/api/ping").status_code == 200
    assert client.get("/api/ping").status_code == 200
    assert client.get("/api/ping").status_code == 429
