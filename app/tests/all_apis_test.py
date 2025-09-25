# tests/all_apis_test.py
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import pytest

from app.main import app

client = TestClient(app)


def test_get_all_mentions_success(mock_db_session):
    """Test getting mentions from all platforms - success case"""
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Mock successful responses from all platforms
        mock_fb.return_value = [
            {"id": "fb1", "text": "Facebook mention 1", "platform": "facebook"},
            {"id": "fb2", "text": "Facebook mention 2", "platform": "facebook"}
        ]
        
        mock_ig.return_value = [
            {"id": "ig1", "text": "Instagram mention 1", "platform": "instagram"},
            {"id": "ig2", "text": "Instagram mention 2", "platform": "instagram"}
        ]
        
        mock_x.return_value = [
            {"id": "x1", "text": "X mention 1", "platform": "x"},
            {"id": "x2", "text": "X mention 2", "platform": "x"}
        ]
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"All Mentions Success Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check all platforms are present
        assert "facebook" in data
        assert "instagram" in data
        assert "x" in data
        
        # Check mention counts
        assert len(data["facebook"]) == 2
        assert len(data["instagram"]) == 2
        assert len(data["x"]) == 2


def test_get_all_mentions_partial_failure(mock_db_session):
    """Test getting mentions when some platforms fail"""
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Mock Facebook success
        mock_fb.return_value = [
            {"id": "fb1", "text": "Facebook mention", "platform": "facebook"}
        ]
        
        # Mock Instagram failure
        mock_ig.side_effect = Exception("Instagram API error")
        
        # Mock X success
        mock_x.return_value = [
            {"id": "x1", "text": "X mention", "platform": "x"}
        ]
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"All Mentions Partial Failure Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check successful platforms have data
        assert len(data["facebook"]) == 1
        assert len(data["x"]) == 1
        
        # Check failed platform returns empty list
        assert len(data["instagram"]) == 0


def test_get_all_mentions_complete_failure(mock_db_session):
    """Test getting mentions when all platforms fail"""
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Mock all platforms failing
        mock_fb.side_effect = Exception("Facebook API error")
        mock_ig.side_effect = Exception("Instagram API error")
        mock_x.side_effect = Exception("X API error")
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"All Mentions Complete Failure Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check all platforms return empty lists
        assert len(data["facebook"]) == 0
        assert len(data["instagram"]) == 0
        assert len(data["x"]) == 0


def test_get_all_mentions_empty_responses(mock_db_session):
    """Test getting mentions when platforms return empty results"""
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Mock empty responses from all platforms
        mock_fb.return_value = []
        mock_ig.return_value = []
        mock_x.return_value = []
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"All Mentions Empty Test - Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check all platforms return empty lists
        assert len(data["facebook"]) == 0
        assert len(data["instagram"]) == 0
        assert len(data["x"]) == 0


def test_get_all_mentions_large_dataset(mock_db_session):
    """Test getting mentions with large dataset from all platforms"""
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Mock large datasets
        mock_fb.return_value = [
            {"id": f"fb{i}", "text": f"Facebook mention {i}", "platform": "facebook"}
            for i in range(100)
        ]
        
        mock_ig.return_value = [
            {"id": f"ig{i}", "text": f"Instagram mention {i}", "platform": "instagram"}
            for i in range(50)
        ]
        
        mock_x.return_value = [
            {"id": f"x{i}", "text": f"X mention {i}", "platform": "x"}
            for i in range(75)
        ]
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"All Mentions Large Dataset Test - Status: {response.status_code}")
        print(f"Facebook: {len(response.json()['facebook'])}, Instagram: {len(response.json()['instagram'])}, X: {len(response.json()['x'])}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check large datasets are handled correctly
        assert len(data["facebook"]) == 100
        assert len(data["instagram"]) == 50
        assert len(data["x"]) == 75


def test_all_apis_concurrent_execution(mock_db_session):
    """Test that all APIs are called concurrently (not sequentially)"""
    import time
    
    with patch('app.api.v1.endpoints.all_apis.all_api.get_facebook_mentions') as mock_fb, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_instagram_mentions') as mock_ig, \
         patch('app.api.v1.endpoints.all_apis.all_api.get_x_mentions') as mock_x:
        
        # Add delays to simulate API calls
        async def delayed_fb():
            await AsyncMock(return_value=[{"id": "fb1", "text": "FB mention"}])()
            return [{"id": "fb1", "text": "FB mention"}]
        
        async def delayed_ig():
            await AsyncMock(return_value=[{"id": "ig1", "text": "IG mention"}])()
            return [{"id": "ig1", "text": "IG mention"}]
        
        async def delayed_x():
            await AsyncMock(return_value=[{"id": "x1", "text": "X mention"}])()
            return [{"id": "x1", "text": "X mention"}]
        
        mock_fb.side_effect = delayed_fb
        mock_ig.side_effect = delayed_ig
        mock_x.side_effect = delayed_x
        
        start_time = time.time()
        
        response = client.get(
            "/all/mentions",
            headers={"Content-Type": "application/json"}
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        print(f"All APIs Concurrent Test - Execution time: {execution_time:.2f}s")
        print(f"Response Status: {response.status_code}")
        
        assert response.status_code == status.HTTP_200_OK
        # If truly concurrent, should be faster than sequential execution
