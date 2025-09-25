# tests/test_facebook_service.py
from fastapi import status
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.main import app

client = TestClient(app)


def test_get_facebook_posts(mock_db_session):
    with patch('app.api.v1.endpoints.facebook.facebook_service.get_fb_posts') as mock_get:
        mock_get.return_value = {
            "success": True,
            "data": [{"id": "post1", "message": "Test post"}]
        }
        
        response = client.get(
            "/facebook/posts",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Facebook Posts Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        assert len(response.json()["data"]) == 1

def test_reply_to_facebook_post():
    with patch('app.api.v1.endpoints.facebook.facebook_service.reply_to_post') as mock_reply:
        mock_reply.return_value = {
            "success": True,
            "data": {"id": "reply123"}
        }
        
        response = client.post(
            "/facebook/reply",
            params={"post_id": "post1", "message": "Test reply"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Facebook Reply Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        assert "id" in response.json()["data"]