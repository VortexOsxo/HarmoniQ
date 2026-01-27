import os

class Profiler:

    LOGS_PATH = 'profile_logs/'

    init_logs = []
    call_logs = []

    @classmethod
    def log_call(cls, function_id, duration):
        cls.call_logs.append(f'Total time [{function_id}]: {duration}')

    @classmethod
    def log_init(cls, init_log: str):
        cls.init_logs.append(init_log)

    @classmethod
    def report(cls):
        if not os.path.exists(cls.LOGS_PATH):
            os.makedirs(cls.LOGS_PATH)

        with open(os.path.join(cls.LOGS_PATH, 'init.txt'), 'w') as f:
            for log in cls.init_logs:
                f.write(log+'\n')

        with open(os.path.join(cls.LOGS_PATH, 'call.txt'), 'w') as f:
            for log in cls.call_logs:
                f.write(log+'\n')

