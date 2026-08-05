# Tax Center - Implementation Guide

## Quick Start

The entire tax dashboard is now configuration-driven with zero hardcoded values.

### For Backend Developers

#### 1. Adding a New Financial Year

```bash
# Step 1: Get ITR JSON from Income Tax Portal
# Download from https://www.incometaxindiaefiling.gov.in/

# Step 2: Save to config directory
cp ~/Downloads/ITR_FY2026-27_AY2027-28.json \
   backend/app/config/FY2026-27_AY2027-28.json

# Step 3: Create database entry
curl -X POST http://localhost:8000/api/tax/years \
  -H "Content-Type: application/json" \
  -d '{
    "financial_year": "2026-27",
    "assessment_year": "2027-28",
    "status": "Filed",
    "filed_at": "2024-07-31T00:00:00Z"
  }'

# Done! Dashboard will automatically load all data from JSON.
```

#### 2. Extending Parser for New Fields

```python
# In backend/app/services/tax_config_service.py

class ITRParser:
    def get_custom_field(self) -> float:
        """Extract custom field from ITR JSON"""
        return float(self._get("Path.To.Field.InJson", 0))
```

#### 3. Adding to API Response

```python
# In get_tax_data() method
return {
    "header": {...},
    "customField": parser.get_custom_field(),
    # ... other sections
}
```

### For Frontend Developers

#### 1. Using the Tax Dashboard Hook

```typescript
import { useTaxDashboard } from "@/hooks/useTaxDashboard";

export const TaxDashboard = ({ taxYear }) => {
  const { data, isLoading, error } = useTaxDashboard(taxYear);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBoundary error={error} />;

  // data is fully typed TaxDashboardViewModel
  return (
    <div>
      <Header {...data.header} />
      <SummaryCards cards={data.summaryCards} />
      <IncomeBreakdown {...data.incomeBreakdown} />
      <TaxBreakdown {...data.taxBreakdown} />
    </div>
  );
};
```

#### 2. Creating a New Component

```typescript
import { IncomeRow } from "@/services/taxMapper";

// ✓ Receive ONLY mapped data
interface IncomeItemProps {
  row: IncomeRow; // From TaxMapper, fully typed
}

export const IncomeItem: React.FC<IncomeItemProps> = ({ row }) => {
  return (
    <div className="flex justify-between">
      <span>{row.label}</span>
      <span>₹{row.value.toLocaleString("en-IN")}</span>
    </div>
  );
};
```

#### 3. Type Safety

```typescript
// The mapper provides full type safety
const viewModel = TaxMapper.mapTaxDashboard(rawData);

// ✓ IDE autocomplete works
viewModel.incomeBreakdown.rows[0].value

// ✓ TypeScript catches errors
viewModel.incomeBreakdown.rows[0].invalidField; // ✗ Error!

// ✓ No need to check for undefined
const salary = viewModel.incomeBreakdown.rows[0].value; // Always exists
```

---

## API Response Structure

The `/api/tax/years/{id}/dashboard` endpoint returns:

```json
{
  "header": {
    "financial_year": "2025-26",
    "assessment_year": "2026-27",
    "form_name": "ITR-2",
    "schema_version": "Ver1.0",
    "tax_regime": "New Regime",
    "residential_status": "RES",
    "return_section": "11",
    "assessee_name": "Pramod Krishna Goudar",
    "verification_place": "BAGALKOT",
    "verification_date": "2026-07-26"
  },
  "summary_cards": [
    {
      "label": "Gross Income",
      "value": 699838.0,
      "meta": "Across all income sources"
    },
    {
      "label": "Taxable Income",
      "value": 699840.0,
      "meta": "After deductions"
    },
    {
      "label": "Final Tax Liability",
      "value": 1132.0,
      "meta": "Health & Education Cess included"
    },
    {
      "label": "Tax Paid",
      "value": 1130.0,
      "meta": "Tax credits and payments",
      "tone": "emerald"
    },
    {
      "label": "Refund / Outstanding",
      "value": 0.0,
      "meta": "Settled",
      "tone": "emerald",
      "badge": "Settled"
    }
  ],
  "income_breakdown": {
    "title": "Income Breakdown",
    "total": 699838.0,
    "rows": [
      {
        "label": "Salary",
        "value": 693000.0
      },
      {
        "label": "Short Term Capital Gain",
        "value": 5438.0
      },
      {
        "label": "Long Term Capital Gain",
        "value": 0.0
      },
      {
        "label": "Interest Income",
        "value": 615.0
      },
      {
        "label": "Indian Dividend",
        "value": 722.0
      },
      {
        "label": "Foreign Dividend",
        "value": 63.0
      }
    ]
  },
  "tax_breakdown": {
    "title": "Tax Breakdown",
    "rows": [
      {
        "label": "Tax Before Rebate",
        "value": 15808.0
      },
      {
        "label": "87A Rebate",
        "value": -14720.0,
        "tone": "emerald"
      },
      {
        "label": "Tax on Special Rates",
        "value": 1088.0,
        "tone": "sky"
      },
      {
        "label": "Education Cess",
        "value": 44.0
      },
      {
        "label": "Final Tax",
        "value": 1132.0
      },
      {
        "label": "Self Assessment Tax",
        "value": 1130.0
      },
      {
        "label": "Advance Tax",
        "value": 0.0
      },
      {
        "label": "TDS",
        "value": 0.0
      }
    ]
  },
  "capital_gains": {
    "title": "Capital Gains Summary",
    "summary": [
      {
        "label": "Short Term Capital Gain",
        "value": 5438.0
      },
      {
        "label": "Long Term Capital Gain",
        "value": 0.0
      }
    ]
  },
  "foreign_income": {
    "title": "Foreign Income & Assets",
    "foreign_income_list": [
      {
        "country": "UNITED STATES OF AMERICA",
        "foreign_income": 63.0,
        "foreign_tax_paid": 12.0,
        "dtaa_relief": "10"
      }
    ],
    "tr_details": [
      {
        "country": "UNITED STATES OF AMERICA",
        "tax_paid_outside": 12.0,
        "relief_section": "90"
      }
    ],
    "foreign_assets_count": 9
  },
  "tax_payments": {
    "title": "Tax Payments",
    "total_advance_tax": 0.0,
    "total_tds": 0.0,
    "total_self_assessment": 1130.0,
    "payment_details": [
      {
        "bsr_code": "0510002",
        "date": "2026-07-17",
        "amount": 1130.0
      }
    ]
  }
}
```

---

## Common Patterns

### Getting a Specific Value

```typescript
// ✗ Don't do this (reaches into raw API)
const salary = data.income_breakdown.rows[0].value;

// ✓ Do this (use mapper)
const viewModel = TaxMapper.mapTaxDashboard(data);
const salary = viewModel.incomeBreakdown.rows[0].value;
```

### Formatting for Display

```typescript
import { formatTaxValue } from "@/services/taxMapper";

// Format as currency
formatTaxValue(699838, "money")  // → "₹699,838"

// Format as percent
formatTaxValue(18.5, "percent")  // → "18.50%"

// Format as number
formatTaxValue(999999, "number") // → "999,999"
```

### Filtering Income Rows

```typescript
const { data } = useTaxDashboard(taxYear);

// Get only income > 0
const nonZeroIncome = data.incomeBreakdown.rows.filter(r => r.value > 0);

// Get total of specific rows
const capitalGains = data.incomeBreakdown.rows
  .filter(r => r.label.includes("Capital"))
  .reduce((sum, r) => sum + r.value, 0);
```

### Checking Foreign Income

```typescript
const { data } = useTaxDashboard(taxYear);

if (data.foreignIncome.foreignIncomeList.length > 0) {
  // Has foreign income
  const firstCountry = data.foreignIncome.foreignIncomeList[0];
  console.log(`Foreign income from ${firstCountry.country}: ₹${firstCountry.foreignIncome}`);
}
```

---

## Troubleshooting

### Issue: API returns null values

**Cause:** Missing field in ITR JSON

**Solution:** Check JSON structure matches expected path in ITRParser. All missing fields default to 0.

```python
# Check if path exists
parser = ITRParser(raw_json)
value = parser._get("Path.To.Value")  # Returns 0 if missing
```

### Issue: Component showing NaN

**Cause:** Not using formatter or arithmetic on unmapped values

**Solution:** Use formatTaxValue() helper:

```typescript
// ✗ Wrong
const text = `₹${data.summaryCards[0].value}`;  // May show "₹undefined"

// ✓ Right
const text = formatTaxValue(data.summaryCards[0].value, "money");
```

### Issue: TypeScript errors in component

**Cause:** Receiving raw API data instead of mapped ViewModel

**Solution:** Use the hook and mapper:

```typescript
// ✗ Wrong
const { data } = useQuery(...);  // Returns raw data

// ✓ Right
const { data } = useTaxDashboard(taxYear);  // Returns TaxDashboardViewModel
```

---

## Performance Tips

### Memoization

```typescript
import { useMemo } from "react";

export const IncomeList = ({ data }: { data: IncomeBreakdown }) => {
  // Memoize filtered list
  const nonZeroIncome = useMemo(
    () => data.rows.filter(r => r.value > 0),
    [data.rows]
  );

  return nonZeroIncome.map(row => <IncomeItem key={row.label} row={row} />);
};
```

### Query Caching

The `useTaxDashboard` hook uses React Query with automatic caching. Change the tax year and it refetches. Same tax year = uses cache.

---

## Testing

### Test with cURL

```bash
# Get all tax years
curl http://localhost:8000/api/tax/years

# Get dashboard for tax year 1
curl http://localhost:8000/api/tax/years/1/dashboard | jq

# Get specific card
curl http://localhost:8000/api/tax/years/1/dashboard | jq '.summary_cards[0]'
```

### Test in TypeScript

```typescript
// Verify mapping works
const rawData = await fetch('/api/tax/years/1/dashboard').then(r => r.json());
const viewModel = TaxMapper.mapTaxDashboard(rawData);

// Should have all properties
expect(viewModel.header).toBeDefined();
expect(viewModel.summaryCards).toHaveLength(5);
expect(viewModel.incomeBreakdown.rows).toBeDefined();
```

---

## Next Steps

1. **Update existing components** to use `useTaxDashboard` hook
2. **Replace hardcoded values** with data from viewModel
3. **Add type hints** to all props
4. **Test dashboard** with live tax years
5. **Deploy** with confidence (no more hardcoding!)

---

## Support

All tax data extraction logic is centralized:
- Backend: `app/services/tax_config_service.py` (ITRParser class)
- Frontend: `src/services/taxMapper.ts` (TaxMapper class)

To debug: Check ITR JSON structure against parser path strings.
