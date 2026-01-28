import time
from functools import wraps
from inspect import iscoroutinefunction
from .utils import get_func_id
from .profiler import Profiler

def timer(func):
    if getattr(func, "__is_profiled__", False):
        return func

    if iscoroutinefunction(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            Profiler.log_call(get_func_id(func))
            start_time = time.time()
            results = await func(*args, **kwargs)
            total_time = time.time() - start_time
            Profiler.log_exit(get_func_id(func), total_time)
            return results
    else:
        @wraps(func)
        def wrapper(*args, **kwargs):
            Profiler.log_call(get_func_id(func))
            start_time = time.time()
            results = func(*args, **kwargs)
            total_time = time.time() - start_time
            Profiler.log_exit(get_func_id(func), total_time)
            return results

    wrapper.__is_profiled__ = True
    return wrapper
