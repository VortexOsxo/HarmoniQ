from harmoniq.webserver.Ludification import selectQuestion, questionList
import pytest

TOTAL = len(questionList)
QUIZ_SIZE = 10
NO_MORE = -2


def test_returns_10_questions_on_first_call():
    questions, answered = selectQuestion([])
    assert len(questions) == QUIZ_SIZE


def test_returned_questions_are_from_question_bank():
    questions, _ = selectQuestion([])
    for q in questions:
        assert q in questionList


def test_no_duplicate_questions_in_quiz():
    questions, _ = selectQuestion([])
    assert len(questions) == len({id(q) for q in questions})


def test_already_answered_excluded():
    # Pre-answer first 5 questions — pass a copy so the original isn't mutated
    original_pre = list(range(5))
    questions, answered = selectQuestion(list(original_pre))
    returned_indices = [questionList.index(q) for q in questions]
    for idx in returned_indices:
        assert idx not in original_pre


def test_answered_list_grows():
    _, answered = selectQuestion([])
    assert len(answered) == QUIZ_SIZE


def test_no_more_flag_when_near_exhaustion():
    # Pre-answer enough so after picking 10 more, fewer than 10 remain for next quiz.
    # Need: (threshold + 10) + 10 > TOTAL  →  threshold > TOTAL - 20
    # Need at least 10 remaining for the while loop: threshold <= TOTAL - 10
    threshold = TOTAL - 15  # leaves 15 unanswered; after quiz total answered > TOTAL
    pre_answered = list(range(threshold))
    _, answered = selectQuestion(pre_answered)
    assert NO_MORE in answered


def test_empty_answered_list_accepted():
    questions, answered = selectQuestion([])
    assert isinstance(questions, list)
    assert isinstance(answered, list)
