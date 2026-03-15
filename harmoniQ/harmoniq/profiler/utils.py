import inspect

def get_func_id(func):
    module = getattr(func, "__module__", "unknown")
    name = getattr(func, "__name__", "unknown")
    return f'{module}.{name}'

def validate_object_source(obj, source):
    path = obj.__name__ if inspect.ismodule(obj) else obj.__module__
    return path.startswith(source)

def load_config():
    import json
    import os
    config_path = os.path.join(os.path.dirname(__file__), 'profiler_config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {"skip_privates": False, "min_duration": 0.0}