import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


class TaxConfigService:
    """Loads an untouched Income Tax Portal export for a filed financial year."""

    def get_tax_data(self, financial_year: str, assessment_year: str | None) -> dict[str, Any]:
        if not assessment_year:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment year is missing for FY {financial_year}.")
        filename = f"FY{financial_year}_AY{assessment_year}.json"
        file_path = CONFIG_DIR / filename
        if not file_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No ITR JSON exists for FY {financial_year}.")
        try:
            return json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"ITR JSON {filename} is invalid.") from exc


tax_config_service = TaxConfigService()
