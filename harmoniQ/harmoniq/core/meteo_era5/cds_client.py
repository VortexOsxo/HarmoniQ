from __future__ import annotations

from pathlib import Path
from typing import Any


class Era5CdsClient:
    def __init__(self, dataset: str):
        self.dataset = dataset
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import cdsapi  # type: ignore
            except ImportError as exc:
                raise ImportError(
                    "cdsapi n'est pas installe. Installez la dependance pour utiliser ERA5."
                ) from exc
            self._client = cdsapi.Client()
        return self._client

    def retrieve(self, request: dict[str, Any], target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        self._get_client().retrieve(self.dataset, request, str(target))
