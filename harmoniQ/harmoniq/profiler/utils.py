import inspect

def get_func_id(func):
    return f'{func.__module__}.{func.__name__}'

def validate_object_source(obj, source):
    path = obj.__name__ if inspect.ismodule(obj) else obj.__module__
    return path.startswith(source)