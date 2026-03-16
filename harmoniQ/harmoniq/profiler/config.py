from typing import Optional

class ProfilerConfig:
    """
    Configuration for the HarmoniQ Profiler.
    
    Attributes:
        skip_privates (bool): If True, private functions starting with '_' will not be profiled.
        min_duration (float): Minimum duration (in seconds) for a function to be included in the report.
        output (str): Destination for report output. Options: 'file', 'console', 'both'.
        output_time (str): When to output report. Options: 'end' (at program exit), 'instant' (as soon as a task completes).
        target (Optional[str]): Specific function or task name to filter profiling for.
    """
    
    skip_privates: bool = False
    min_duration: float = 0.001
    output: str = "console"        # 'file', 'console', 'both'
    output_time: str = "instant"    # 'end', 'instant'
    target: Optional[str] = "calculer_production"
