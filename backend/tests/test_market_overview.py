import unittest
from datetime import datetime, timezone
from app.schemas.market import MarketOverviewItem
from app.services.market_service import (
    _convert_commodity_price_to_inr_display_unit,
    GOLD_DISPLAY_GRAMS,
    SILVER_DISPLAY_GRAMS,
    TROY_OUNCE_IN_GRAMS,
    INDIA_BULLION_LANDED_PREMIUM,
)


class MarketOverviewTests(unittest.TestCase):
    def test_schema_accepts_economic_times_source(self) -> None:
        item = MarketOverviewItem(
            name="GOLD",
            symbol="GC=F",
            price=150999.0,
            change=1500.0,
            change_pct=1.0,
            currency="INR",
            source="economic_times",
            last_updated=datetime.now(timezone.utc),
        )
        self.assertEqual(item.price, 150999.0)
        self.assertEqual(item.source, "economic_times")

    def test_convert_commodity_price_with_landed_duty_factor(self) -> None:
        # Suppose COMEX gold is $4,200/oz, USD/INR is 88.0
        comex_gold_price = 4200.0
        comex_gold_change = 42.0
        usd_to_inr = 88.0

        price, change = _convert_commodity_price_to_inr_display_unit(
            price=comex_gold_price,
            change=comex_gold_change,
            usd_to_inr_rate=usd_to_inr,
            grams_per_display_unit=GOLD_DISPLAY_GRAMS,
        )

        # Expected: price * rate * (10 / 31.1034768) * 1.145
        expected_multiplier = (10.0 / TROY_OUNCE_IN_GRAMS) * INDIA_BULLION_LANDED_PREMIUM
        expected_price = comex_gold_price * usd_to_inr * expected_multiplier
        self.assertIsNotNone(price)
        self.assertAlmostEqual(price, expected_price, places=2)
        self.assertGreater(price, 130000.0)

    def test_convert_silver_price_to_1kg_inr(self) -> None:
        # Suppose COMEX silver is $60.0/oz, USD/INR is 88.0
        comex_silver_price = 60.0
        comex_silver_change = 0.6
        usd_to_inr = 88.0

        price, change = _convert_commodity_price_to_inr_display_unit(
            price=comex_silver_price,
            change=comex_silver_change,
            usd_to_inr_rate=usd_to_inr,
            grams_per_display_unit=SILVER_DISPLAY_GRAMS,
        )

        expected_multiplier = (1000.0 / TROY_OUNCE_IN_GRAMS) * INDIA_BULLION_LANDED_PREMIUM
        expected_price = comex_silver_price * usd_to_inr * expected_multiplier
        self.assertIsNotNone(price)
        self.assertAlmostEqual(price, expected_price, places=2)
        self.assertGreater(price, 190000.0)


if __name__ == "__main__":
    unittest.main()

