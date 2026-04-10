import os
import pytest

os.environ["HARMONIQ_TESTING"] = "True"

def pytest_addoption(parser):
    parser.addoption(
        "--perf", action="store_true", default=False, help="run performance tests"
    )

def pytest_collection_modifyitems(config, items):
    if config.getoption("--perf"):
        return
    skip_perf = pytest.mark.skip(reason="need --perf option to run")
    for item in items:
        if "performance" in item.keywords:
            item.add_marker(skip_perf)
