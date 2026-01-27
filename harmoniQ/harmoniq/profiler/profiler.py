import os
from enum import Enum

class ProfilerLogType(Enum):
    Init = 'Init'
    Call = 'Call'
    Exit = 'Exit'
    Exec = 'Exec'


class ProfilerLog:
    def __init__(self, type: ProfilerLogType, func_id: str, **kwargs):
        self.type = type 
        self.func_id = func_id
        self.kwargs = kwargs

    def __str__(self):
        depth = self.kwargs.get('depth', 0)
        base = f'{depth*"  "}[{self.type.value}]   [{self.func_id}]'
        if self.type in [ProfilerLogType.Init, ProfilerLogType.Call]:
            return base + '\n'
        elif self.type in [ProfilerLogType.Exit, ProfilerLogType.Exec]:
            duration = self.kwargs.get("duration", -1)
            return f'{base}  {duration}\n'
        

class Profiler:

    LOGS_PATH = 'profile_logs/'

    init_logs = []
    call_logs = []

    _depth = 0

    @classmethod
    def log_call(cls, func_id):
        log = ProfilerLog(ProfilerLogType.Call, func_id, depth=cls._depth)
        cls.call_logs.append(log)
        cls._depth += 1

    @classmethod
    def log_exit(cls, func_id, duration):
        cls._depth -= 1
        log = ProfilerLog(ProfilerLogType.Exit, func_id, depth=cls._depth, duration=duration)
        cls.call_logs.append(log)

    @classmethod
    def log_init(cls, func_id):
        log = ProfilerLog(ProfilerLogType.Init, func_id)
        cls.init_logs.append(log)

    @classmethod
    def report(cls):
        cls._reduce()

        os.makedirs(cls.LOGS_PATH, exist_ok=True)

        with open(os.path.join(cls.LOGS_PATH, 'init.txt'), 'w') as f:
            for log in cls.init_logs:
                f.write(str(log))

        with open(os.path.join(cls.LOGS_PATH, 'call.txt'), 'w') as f:
            for log in cls.call_logs:
                f.write(str(log))


    @classmethod
    def _reduce(cls):
        reduced_logs = []
        exits = {}
        for log in reversed(cls.call_logs):
            if log.type == ProfilerLogType.Exit:
                exits[(log.func_id, log.kwargs['depth'])] = log.kwargs['duration']
            elif log.type == ProfilerLogType.Call:
                duration = exits[(log.func_id, log.kwargs['depth'])]
                reduced_logs.append(ProfilerLog(ProfilerLogType.Exec, log.func_id, depth=log.kwargs['depth'], duration=duration))
        reduced_logs.reverse()
        cls.call_logs = reduced_logs