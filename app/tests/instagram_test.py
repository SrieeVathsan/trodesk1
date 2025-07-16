# tests/test_instagram_service.py
from fastapi import status
from fastapi import status
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.main import app

client = TestClient(app)


def test_get_instagram_mentions(mock_db_session):
    with patch('app.api.v1.endpoints.instagram.insta_service.fetch_ig_mentions') as mock_fetch:
        mock_fetch.return_value = {
            "success": True,
            "data": [{"id": "mention1", "caption": "Test mention"}]
        }
        
        response = client.get(
            "/instagram/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Instagram Mentions Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        assert len(response.json()["data"]) == 1

def test_send_private_reply():
    with patch('app.api.v1.endpoints.instagram.insta_service.instagram_private_reply') as mock_reply:
        mock_reply.return_value = {
            "success": True,
            "message_id": "msg123"
        }
        
        response = client.post(
            "/instagram/private-reply",
            params={"comment_id": "comment1", "message": "Test reply"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Instagram Private Reply Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        assert "message_id" in response.json()