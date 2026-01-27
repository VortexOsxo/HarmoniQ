import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(
        description="Lancer l'interface web",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Activer le mode debug",
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
        "--profile",
        action="store_true",
        help="Activer le mode profiler",
    )

    args = parser.parse_args()
    if args.profile:
        import logging
        logging.basicConfig(level=logging.INFO)
        from harmoniq.profiler import Initializer

        import harmoniq.modules
        Initializer.init_module(harmoniq.modules)

        import harmoniq.core
        Initializer.init_module(harmoniq.core)

        import harmoniq.db
        Initializer.init_module(harmoniq.db)

    try:
        if args.debug:
            uvicorn.run(
                "harmoniq.webserver:app", host=args.host, port=int(args.port), reload=True
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
