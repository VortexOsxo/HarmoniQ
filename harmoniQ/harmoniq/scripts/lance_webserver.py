import argparse
import logging
import os
import sys
from pathlib import Path

import uvicorn


def get_client_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "client"


def main():
    parser = argparse.ArgumentParser(
        description="Lancer l'interface web (HarmoniQ)",
    )
    mode_group = parser.add_mutually_exclusive_group()

    mode_group.add_argument(
        "--debug",
        action="store_true",
        help="Activer le mode debug (rechargement automatique du backend)",
    )
    mode_group.add_argument(
        "--profile",
        action="store_true",
        help="Activer le mode profiler",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Adresse IP du serveur",
    )
    parser.add_argument(
        "--port",
        default=5000,
        help="Port du serveur",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Nombre de processus de travail",
    )

    args = parser.parse_args()
    log_level = "DEBUG" if args.debug else "WARNING"
    os.environ.setdefault("LOG_LEVEL", log_level)
    logging.basicConfig(level=getattr(logging, log_level))
    logging.getLogger().setLevel(getattr(logging, log_level))

    if args.profile:
        from harmoniq.profiler import Initializer

        import harmoniq.modules
        Initializer.init_module(harmoniq.modules)

        import harmoniq.core
        Initializer.init_module(harmoniq.core)

        import harmoniq.db
        Initializer.init_module(harmoniq.db)

        import harmoniq.webserver
        Initializer.init_module(harmoniq.webserver)
    try:
        if args.debug:
            print("[launch-app] Starting backend in debug mode (auto-reload enabled)...")
            uvicorn.run(
                "harmoniq.webserver:app", host=args.host, port=int(args.port), reload=True, workers=(args.workers)
            )
        else:
            print(f"[launch-app] Starting server on http://{args.host}:{args.port}")
            uvicorn.run(
                "harmoniq.webserver:app",
                host=args.host,
                port=int(args.port),
                workers=1,
            )
    finally:
        if args.profile:
            from harmoniq.profiler import Profiler
            Profiler.report()


if __name__ == "__main__":
    main()
