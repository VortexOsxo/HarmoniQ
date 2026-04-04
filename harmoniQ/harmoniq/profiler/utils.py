import inspect

def get_func_id(func):
    module = getattr(func, "__module__", "unknown")
    name = getattr(func, "__name__", "unknown")
    return f'{module}.{name}'

def validate_object_source(obj, source):
    path = obj.__name__ if inspect.ismodule(obj) else obj.__module__
    return path.startswith(source)