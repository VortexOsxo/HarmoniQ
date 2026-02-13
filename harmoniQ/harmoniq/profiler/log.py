from enum import Enum

class LogType(Enum):
    Init = 'Init'
    Call = 'Call'
    Exit = 'Exit'
    Exec = 'Exec'


class Log:
    def __init__(self, type: LogType, func_id: str, **kwargs):
        self.type = type 
        self.func_id = func_id
        self.kwargs = kwargs

    def __str__(self):
        depth = self.kwargs.get('depth', 0)
        base = f'{depth*"  "}[{self.type.value}]   [{self.func_id}]'
        if self.type in [LogType.Init, LogType.Call]:
            return base + '\n'
        elif self.type in [LogType.Exit, LogType.Exec]:
            duration = self.kwargs.get("duration", -1)
            return f'{base}  {duration}\n'

class LogContainer():
    def __init__(self):
        self.logs = []
        self.depth = 0
    
    def log_call(self, func_id):
        log = Log(LogType.Call, func_id, depth=self.depth)
        self.logs.append(log)
        self.depth += 1

    def log_exit(self, func_id, duration):
        self.depth -= 1
        log = Log(LogType.Exit, func_id, depth=self.depth, duration=duration)
        self.logs.append(log)
    
    def log_init(self, func_id):
        log = Log(LogType.Init, func_id)
        self.logs.append(log)

    def get_logs(self):
        reduced_logs = []
        exits = {}
        for log in reversed(self.logs):
            if log.type == LogType.Exit:
                exits[(log.func_id, log.kwargs['depth'])] = log.kwargs['duration']
            elif log.type == LogType.Call:
                duration = exits[(log.func_id, log.kwargs['depth'])]
                reduced_logs.append(Log(LogType.Exec, log.func_id, depth=log.kwargs['depth'], duration=duration))
            elif log.type == LogType.Init:
                reduced_logs.append(log)
        reduced_logs.reverse()
        return reduced_logs