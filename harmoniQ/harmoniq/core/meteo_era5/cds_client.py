from __future__ import annotations

from pathlib import Path
from typing import Any


class Era5CdsClient:
    def __init__(self, dataset: str):
        self.dataset = dataset
        self._client = self._build_client()

    @staticmethod
    def _build_client():
        try:
            import cdsapi  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "cdsapi n'est pas installe. Installez la dependance pour utiliser ERA5."
            ) from exc
        return cdsapi.Client()

    def retrieve(self, request: dict[str, Any], target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        self._client.retrieve(self.dataset, request, str(target))
