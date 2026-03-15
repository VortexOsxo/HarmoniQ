import os
import asyncio

from harmoniq.profiler import LogContainer, load_config

class Profiler:

    LOGS_PATH = 'profile_logs/'

    logs_container = {}
    config = load_config()

    @classmethod
    def log_call(cls, func_id):
        cls._get_container().log_call(func_id)

    @classmethod
    def log_exit(cls, func_id, duration):
        container = cls._get_container()
        container.log_exit(func_id, duration)

        if container.is_complete() and cls.config.get("output_time") == "instant":
            name = cls._get_name()
            cls._report_taks_container(name, container)
            cls._remove_container(name)

    @classmethod
    def log_init(cls, func_id):
        cls._get_container('init').log_init(func_id)

    @classmethod
    def report(cls):
        cls._report_init_container()

        for name, container in cls.logs_container.items():
            if name == 'init': continue
            cls._report_taks_container(name, container)

    @classmethod
    def _report_taks_container(cls, name, container):
        output_mode = cls.config.get("output", "file")
        if output_mode in ["file", "both"]:
            with open(os.path.join(cls.LOGS_PATH, 'call.txt'), 'w') as f:
                f.write(f'\n\nTask: {name}\n')
                for log in container.get_logs():
                    f.write(str(log))
        
        if output_mode in ["console", "both"]:
            print(f'\n\nTask: {name}')
            for log in container.get_logs():
                print(str(log), end='')

    @classmethod
    def _report_init_container(cls):
        container = cls._get_container('init')
        if container is None: return

        with open(os.path.join(cls.LOGS_PATH, 'init.txt'), 'w') as f:
            for log in container.get_logs():
                f.write(str(log))

    @classmethod
    def _get_name(cls):
        task = asyncio.current_task()
        return task.get_name()

    @classmethod
    def _get_container(cls, name='') -> LogContainer:
        name = name or cls._get_name()

        if name not in cls.logs_container:
            cls.logs_container[name] = LogContainer()
        return cls.logs_container[name]

    @classmethod
    def _remove_container(cls, name):
        if name not in cls.logs_container: return
        del cls.logs_container[name]