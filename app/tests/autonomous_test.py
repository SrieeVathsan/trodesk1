# tests/autonomous_test.py
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.main import app

client = TestClient(app)


def test_start_autonomous_service():
    """Test starting the autonomous reply service"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as not running initially
        mock_service.is_running = False
        mock_service.start_autonomous_service = AsyncMock()
        
        response = client.post(
            "/autonomous/start",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Start Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "started"
        assert "Autonomous reply service started" in response.json()["message"]


def test_start_autonomous_service_already_running():
    """Test starting autonomous service when it's already running"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as already running
        mock_service.is_running = True
        
        response = client.post(
            "/autonomous/start",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Already Running Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "already_running"
        assert "already running" in response.json()["message"]


def test_stop_autonomous_service():
    """Test stopping the autonomous reply service"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as running
        mock_service.is_running = True
        
        response = client.post(
            "/autonomous/stop",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Stop Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "stopped"
        assert "Autonomous reply service stopped" in response.json()["message"]


def test_stop_autonomous_service_not_running():
    """Test stopping autonomous service when it's not running"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as not running
        mock_service.is_running = False
        
        response = client.post(
            "/autonomous/stop",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Not Running Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "not_running"
        assert "not running" in response.json()["message"]


def test_get_autonomous_status_running():
    """Test getting autonomous service status when running"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as running
        mock_service.is_running = True
        
        response = client.get(
            "/autonomous/status",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Status Running Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "running"
        assert response.json()["is_running"] is True


def test_get_autonomous_status_stopped():
    """Test getting autonomous service status when stopped"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock service as stopped
        mock_service.is_running = False
        
        response = client.get(
            "/autonomous/status",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Status Stopped Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "stopped"
        assert response.json()["is_running"] is False


def test_run_autonomous_cycle_once_success(mock_db_session):
    """Test running one autonomous cycle manually - success case"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock successful cycle
        mock_service.fetch_all_mentions = AsyncMock()
        mock_service.process_unreplied_mentions = AsyncMock(return_value={
            "status": "completed",
            "processed": 5,
            "failed": 0
        })
        
        response = client.post(
            "/autonomous/run-once",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Run Once Success Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "success"
        assert "Autonomous cycle completed" in response.json()["message"]
        assert "result" in response.json()


def test_run_autonomous_cycle_once_error(mock_db_session):
    """Test running one autonomous cycle manually - error case"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Mock error during cycle
        mock_service.fetch_all_mentions = AsyncMock(side_effect=Exception("Database error"))
        
        response = client.post(
            "/autonomous/run-once",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Autonomous Run Once Error Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "error"
        assert "Error running autonomous cycle" in response.json()["message"]


def test_autonomous_service_integration():
    """Integration test for autonomous service workflow"""
    with patch('app.api.v1.endpoints.autonomous.autonomous_api.autonomous_service') as mock_service:
        # Test complete workflow: start -> status -> run-once -> stop
        
        # 1. Start service
        mock_service.is_running = False
        mock_service.start_autonomous_service = AsyncMock()
        start_response = client.post("/autonomous/start")
        assert start_response.json()["status"] == "started"
        
        # 2. Check status (simulate running)
        mock_service.is_running = True
        status_response = client.get("/autonomous/status")
        assert status_response.json()["is_running"] is True
        
        # 3. Run one cycle
        mock_service.fetch_all_mentions = AsyncMock()
        mock_service.process_unreplied_mentions = AsyncMock(return_value={
            "status": "completed", "processed": 3, "failed": 1
        })
        cycle_response = client.post("/autonomous/run-once")
        assert cycle_response.json()["status"] == "success"
        
        # 4. Stop service
        stop_response = client.post("/autonomous/stop")
        assert stop_response.json()["status"] == "stopped"
        
        print("Autonomous Service Integration Test - All steps completed successfully")
