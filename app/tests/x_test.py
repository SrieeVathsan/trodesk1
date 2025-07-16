# tests/test_x_service.py
from fastapi import status
from fastapi import status
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.main import app

client = TestClient(app)


def test_get_x_mentions(mock_db_session):
    with patch('app.api.v1.endpoints.x.x_service.fetch_mentions') as mock_fetch:
        mock_fetch.return_value = {
            "data": [{"id": "tweet1", "text": "Test tweet"}]
        }
        
        response = client.get(
            "/x/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"X Mentions Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["data"]) == 1

def test_reply_to_tweet():
    with patch('app.api.v1.endpoints.x.x_service.process_unreplied_mentions') as mock_process:
        mock_process.return_value = {
            "status": "done",
            "replied": [{"id": "tweet1", "reply_id": "reply123"}]
        }
        
        response = client.post(
            "/x/reply",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"X Reply Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "done"
        assert len(response.json()["replied"]) == 1