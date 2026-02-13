import os
import asyncio

from harmoniq.profiler import Log, LogType, LogContainer

class Profiler:

    LOGS_PATH = 'profile_logs/'

    logs_container = {}

    @classmethod
    def log_call(cls, func_id):
        cls._get_container().log_call(func_id)

    @classmethod
    def log_exit(cls, func_id, duration):
        cls._get_container().log_exit(func_id, duration)

    @classmethod
    def log_init(cls, func_id):
        cls._get_container('init').log_init(func_id)

    @classmethod
    def report(cls):
        os.makedirs(cls.LOGS_PATH, exist_ok=True)

        with open(os.path.join(cls.LOGS_PATH, 'init.txt'), 'w') as f:
            container = cls.logs_container.pop('init')
            for log in container.get_logs():
                f.write(str(log))

        with open(os.path.join(cls.LOGS_PATH, 'call.txt'), 'w') as f:
            for name, container in cls.logs_container.items():
                f.write(f'\n\nTask: {name}\n')
                for log in container.get_logs():
                    f.write(str(log))


    @classmethod
    def _get_container(cls, name='') -> LogContainer:
        if not name:
            task = asyncio.current_task()
            name = task.get_name()

        if name not in cls.logs_container:
            cls.logs_container[name] = LogContainer()
        return cls.logs_container[name]