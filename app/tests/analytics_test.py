# tests/test_analytics_service.py
from fastapi import status
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.main import app

client = TestClient(app)



def test_get_sentiment_analytics(mock_db_session):
    with patch('app.services.analytics_service.get_sentiment_counts') as mock_sentiment:
        mock_sentiment.return_value = {
            "positive": 5,
            "negative": 2,
            "total": 7
        }
        
        response = client.get(
            "/sentiment",
            params={"days": 7},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["positive"] == 5
        assert response.json()["negative"] == 2


def test_resolve_ticket(mock_db_session, mock_mention):
    with patch('app.api.v1.endpoints.analytics.analytics_api.resolve_ticket') as mock_resolve:
        mock_resolve.return_value = {
            "success": True,
            "message": "Mention tweet1 marked as resolved",
            "ticket_status": "resolved"
        }
        
        response = client.post(
            "/tickets/tweet1/resolve",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Resolve Ticket Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        assert response.json()["ticket_status"] == "resolved"