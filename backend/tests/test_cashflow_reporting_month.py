import unittest
from unittest.mock import patch

from app.services import cashflow_service


class _ScalarsResult:
    def __init__(self, values: list[str]) -> None:
        self._values = values

    def all(self) -> list[str]:
        return self._values


class _DB:
    def __init__(self, months: list[str]) -> None:
        self._months = months

    def scalars(self, _query: object) -> _ScalarsResult:
        return _ScalarsResult(self._months)


class CashflowReportingMonthTests(unittest.TestCase):
    def test_uses_previous_month_when_current_month_has_no_entries(self) -> None:
        with patch.object(cashflow_service, "current_month_string", return_value="2026-09"):
            with patch.object(cashflow_service, "previous_month_string", return_value="2026-08"):
                self.assertEqual(cashflow_service.get_reporting_month(_DB(["2026-08", "2026-07"])), "2026-08")

    def test_skips_current_month_when_current_month_has_entries(self) -> None:
        with patch.object(cashflow_service, "current_month_string", return_value="2026-09"):
            with patch.object(cashflow_service, "previous_month_string", return_value="2026-08"):
                self.assertEqual(cashflow_service.get_reporting_month(_DB(["2026-09", "2026-08"])), "2026-08")


if __name__ == "__main__":
    unittest.main()
