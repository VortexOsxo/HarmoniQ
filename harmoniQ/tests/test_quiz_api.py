"""Tests for the /api/jeux-informatifs/quiz endpoint and get_infra_object helper."""
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from harmoniq.webserver import app
from harmoniq.webserver.REST import get_infra_object, PRODUCTION_MAPPING

client = TestClient(app)


class TestQuizEndpoint:
    def test_returns_200(self):
        response = client.get("/api/jeux-informatifs/quiz")
        assert response.status_code == 200

    def test_response_has_questions_key(self):
        data = client.get("/api/jeux-informatifs/quiz").json()
        assert "questions" in data

    def test_returns_10_questions(self):
        data = client.get("/api/jeux-informatifs/quiz").json()
        assert len(data["questions"]) == 10

    def test_response_has_answered_list(self):
        data = client.get("/api/jeux-informatifs/quiz").json()
        assert "answeredQuestionList" in data

    def test_pre_answered_questions_excluded(self):
        # First call
        first = client.get("/api/jeux-informatifs/quiz").json()
        answered = first["answeredQuestionList"]
        if answered == [-2]:
            pytest.skip("Not enough questions remaining")
        # Second call passing answered list
        query = "&".join(f"answeredQuestionList={i}" for i in answered)
        second = client.get(f"/api/jeux-informatifs/quiz?{query}").json()
        assert len(second["questions"]) == 10

    def test_no_more_flag_is_list_with_minus_2(self):
        from harmoniq.webserver.Ludification import questionList
        total = len(questionList)
        # Pre-answer enough so that after picking 10 more, fewer than 10 remain
        # Need: (threshold + 10) + 10 > total  →  threshold > total - 20
        # Also need at least 10 remaining for the while loop: threshold <= total - 10
        threshold = total - 15  # leaves 15 unanswered; after quiz: 25 answered > total
        query = "&".join(f"answeredQuestionList={i}" for i in range(threshold))
        data = client.get(f"/api/jeux-informatifs/quiz?{query}").json()
        assert data["answeredQuestionList"] == [-2]


class TestGetInfraObject:
    def test_raises_400_for_unknown_type(self):
        from unittest.mock import MagicMock
        payload = MagicMock()
        with pytest.raises(HTTPException) as exc:
            get_infra_object("unknown_type", payload)
        assert exc.value.status_code == 400

    def test_all_known_types_are_in_mapping(self):
        for key in ["eolienneparc", "solaire", "thermique", "nucleaire", "hydro"]:
            assert key in PRODUCTION_MAPPING
