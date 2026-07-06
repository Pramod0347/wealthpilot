import unittest
from decimal import Decimal

from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.deposit import Deposit
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.services.wealth_bucket_service import build_wealth_buckets


class DepositWealthBucketsTests(unittest.TestCase):
    def test_active_deposits_are_counted_as_assets_but_returned_are_excluded(self) -> None:
        active_deposit = Deposit(
            id=1,
            name="House Rent Deposit",
            type="rent_deposit",
            amount=Decimal("50000"),
            property_name="Sunset House",
            description=None,
            paid_date=None,
            refundable=True,
            status="active",
            returned_date=None,
        )
        returned_deposit = Deposit(
            id=2,
            name="Security Deposit",
            type="security_deposit",
            amount=Decimal("20000"),
            property_name=None,
            description=None,
            paid_date=None,
            refundable=True,
            status="returned",
            returned_date=None,
        )

        asset_buckets, liability_bucket = build_wealth_buckets(
            holdings=[],
            bank_accounts=[],
            fixed_savings_accounts=[],
            credit_cards=[],
            deposits=[active_deposit, returned_deposit],
            total_assets=Decimal("50000"),
        )

        deposit_bucket = next((bucket for bucket in asset_buckets if bucket.asset_type == "deposits"), None)
        self.assertIsNotNone(deposit_bucket)
        self.assertEqual(deposit_bucket.amount, Decimal("50000"))
        self.assertEqual(len(deposit_bucket.items), 1)
        self.assertEqual(deposit_bucket.items[0].name, "House Rent Deposit")
        self.assertIsNone(liability_bucket)


if __name__ == "__main__":
    unittest.main()
