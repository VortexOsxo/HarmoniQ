from enum import Enum
from .utils import load_config

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
        indent = depth * "  "
        
        if self.type in [LogType.Init, LogType.Call]:
            return f'{indent}[{self.type.value}]   [{self.func_id}]\n'
        
        elif self.type in [LogType.Exit, LogType.Exec]:
            duration = self.kwargs.get("duration", 0)
            percentage = self.kwargs.get("percentage", 100.0)
            
            duration_fmt = f"{duration:.3f}"
            percentage_fmt = f"({percentage:.2f}%)"
            
            return f'{indent}{duration_fmt} {percentage_fmt} [{self.type.value}]   [{self.func_id}]\n'

class LogContainer():
    def __init__(self):
        self.logs = []
        self.depth = 0
        self.config = load_config()
    
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
    
    def is_complete(self):
        return self.depth == 0

    def get_logs(self):
        reduced_logs = []
        exits = {}
        durations_at_depth = {}
        min_duration = self.config.get('min_duration', 0.0)
        
        for log in reversed(self.logs):
            if log.type == LogType.Exit:
                depth = log.kwargs['depth']
                duration = log.kwargs['duration']
                exits[(log.func_id, depth)] = duration
                durations_at_depth[depth] = duration
            elif log.type == LogType.Call:
                depth = log.kwargs['depth']
                duration = exits[(log.func_id, depth)]
                
                if duration < min_duration:
                    continue
                    
                parent_duration = durations_at_depth.get(depth - 1)
                if parent_duration and parent_duration > 0:
                    percentage = (duration / parent_duration) * 100
                else:
                    percentage = 100.0
                    
                reduced_logs.append(Log(LogType.Exec, log.func_id, depth=depth, duration=duration, percentage=percentage))
            elif log.type == LogType.Init:
                reduced_logs.append(log)
        
        reduced_logs.reverse()
        return reduced_logs