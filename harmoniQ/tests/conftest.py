import os
import pytest

os.environ["HARMONIQ_TESTING"] = "True"

def pytest_addoption(parser):
    parser.addoption(
        "--performance", action="store_true", default=False, help="run performance tests"
    )
    parser.addoption(
        "--resources", action="store_true", default=False, help="run resource limit tests"
    )

def pytest_collection_modifyitems(config, items):
    run_perf = config.getoption("--performance")
    run_res = config.getoption("--resources")
    for item in items:
        if "performance" in item.keywords and not run_perf:
            item.add_marker(pytest.mark.skip(reason="need --performance option to run"))
        if "resources" in item.keywords and not run_res:
            item.add_marker(pytest.mark.skip(reason="need --resources option to run"))
