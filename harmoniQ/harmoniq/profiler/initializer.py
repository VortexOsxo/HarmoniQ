import inspect
import pkgutil
import importlib

from harmoniq.profiler import timer, validate_object_source, Profiler

class Initializer:
    skipped_functions = ['__init__', '__repr__', '__new__', '__str__']

    @classmethod
    def init_module(cls, module, visited=None):
        if visited is None:
            visited = set()

        if module in visited:
            return

        visited.add(module)
        if not validate_object_source(module, "harmoniq"):
            return

        if hasattr(module, "__path__"):
            for _, modname, _ in pkgutil.iter_modules(module.__path__):
                full_name = f"{module.__name__}.{modname}"
                try:
                    submodule = importlib.import_module(full_name)
                    cls.init_module(submodule, visited)
                except ImportError:
                    pass

        for name, obj in vars(module).items():
            if inspect.ismodule(obj):
                cls.init_module(obj, visited)
            
            elif inspect.isclass(obj):
                cls.init_class(obj)

            elif inspect.isfunction(obj):
                cls.init_function(module, obj, name)

    @classmethod
    def init_class(cls, clas):
        if not validate_object_source(clas, "harmoniq"):
            return
        for name, obj in vars(clas).items():
            if inspect.isfunction(obj):
                cls.init_function(clas, obj, name)

    @classmethod
    def init_function(cls, owner, function, name):
        if function.__name__ in cls.skipped_functions: return
        Profiler.log_init(f"Decorating {owner.__name__}.{name}")
        setattr(owner, name, timer(function))