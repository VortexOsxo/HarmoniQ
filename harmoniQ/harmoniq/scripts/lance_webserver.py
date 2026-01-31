import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(
        description="Lancer l'interface web",
    )
    mode_group = parser.add_mutually_exclusive_group()

    mode_group.add_argument(
        "--debug",
        action="store_true",
        help="Activer le mode debug",
    )
    mode_group.add_argument(
        "--profile",
        action="store_true",
        help="Activer le mode profiler",
    )
    parser.add_argument(
        "--skip-privates",
        action="store_true",
        help="Ignorer les méthodes privées dans le profilage",
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
    if args.profile:
        from harmoniq.profiler import Initializer

        if args.skip_privates:
            Initializer.skip_privates = True

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
            uvicorn.run(
                "harmoniq.webserver:app", host=args.host, port=int(args.port), reload=True, workers=(args.workers)
            )
        else:
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
