import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

NODE_VERSION = "24.13.0"

LOG_PREFIX = "[launch-app]"


def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, letting stdout/stderr flow to the console."""
    return subprocess.run(cmd, **kwargs)


def _is_node_installed() -> bool:
    """Return True if `node` is available on PATH."""
    return shutil.which("node") is not None


def _install_node_windows() -> None:
    arch = platform.machine().lower()
    if arch in ("amd64", "x86_64"):
        arch_label = "x64"
    elif arch == "arm64":
        arch_label = "arm64"
    else:
        arch_label = "x86"

    url = (
        f"https://nodejs.org/dist/v{NODE_VERSION}/"
        f"node-v{NODE_VERSION}-{arch_label}.msi"
    )

    with tempfile.TemporaryDirectory() as tmp:
        msi_path = Path(tmp) / "node_installer.msi"

        print(f"{LOG_PREFIX} Downloading Node.js v{NODE_VERSION} for Windows ({arch_label})")
        urllib.request.urlretrieve(url, str(msi_path))

        print(f"{LOG_PREFIX} Installing Node.js silently")
        result = _run(
            [
                "powershell", "-Command",
                f'Start-Process msiexec -ArgumentList "/i","{msi_path}","/qn","/norestart" -Verb RunAs -Wait'
            ],
        )

        if result.returncode != 0:
            print(
                f"{LOG_PREFIX} Node.js silent install exited with code {result.returncode}.",
                file=sys.stderr,
            )
            sys.exit(result.returncode)

    _refresh_path_windows()


def _refresh_path_windows() -> None:
    import winreg

    parts: list[str] = []
    for hive, sub_key in (
        (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
        (winreg.HKEY_CURRENT_USER, r"Environment"),
    ):
        try:
            with winreg.OpenKey(hive, sub_key) as key:
                value, _ = winreg.QueryValueEx(key, "Path")
                parts.extend(value.split(";"))
        except OSError:
            pass

    import os
    os.environ["PATH"] = ";".join(parts)


def _install_node_macos() -> None:
    if shutil.which("brew") is None:
        print(f"{LOG_PREFIX} Homebrew not found – installing Homebrew first…")
        result = _run(
            ["/bin/bash", "-c",
             'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'],
        )
        if result.returncode != 0:
            print(f"{LOG_PREFIX} Homebrew installation failed!", file=sys.stderr)
            sys.exit(result.returncode)

        import os
        for brew_path in ("/opt/homebrew/bin", "/usr/local/bin"):
            if brew_path not in os.environ["PATH"]:
                os.environ["PATH"] = f"{brew_path}:{os.environ['PATH']}"

    print(f"{LOG_PREFIX} Installing Node.js via Homebrew…")
    result = _run(["brew", "install", "node"])
    if result.returncode != 0:
        print(f"{LOG_PREFIX} Node.js installation via Homebrew failed!", file=sys.stderr)
        sys.exit(result.returncode)



def ensure_node_installed() -> None:
    """Check for Node.js; if missing, install it silently for the current OS."""
    if _is_node_installed():
        print(f"{LOG_PREFIX} Node.js found")
        return

    os_name = platform.system()
    print(f"{LOG_PREFIX} Node.js not found – attempting automatic install on {os_name}")

    if os_name == "Windows":
        _install_node_windows()
    elif os_name == "Darwin":
        _install_node_macos()

    if not _is_node_installed():
        print(
            f"{LOG_PREFIX} Node.js installation appeared to succeed but `node` "
            "is still not found on PATH. You may need to open a new terminal.",
            file=sys.stderr,
        )
        sys.exit(1)

    _run(["node", "--version"])
    print(f"{LOG_PREFIX} Node.js installed successfully.")
