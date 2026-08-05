/**
 * Example: Tax Dashboard Summary Card Component
 *
 * This component demonstrates best practices for consuming mapped tax data.
 *
 * Key principles:
 * 1. Receives ONLY mapped ViewModel data (never raw API data)
 * 2. No hardcoded values anywhere in the component
 * 3. All data comes from ITR JSON via TaxMapper
 * 4. Component is purely presentational
 * 5. Strongly typed throughout
 *
 * BEFORE (hardcoded):
 * ```
 * return <div>Gross Income: ₹{data.summary.cards[0].value}</div>
 * ```
 *
 * AFTER (config-driven):
 * ```
 * const { data } = useTaxDashboard(taxYear);
 * return (
 *   <Card label={data.summaryCards[0].label} value={data.summaryCards[0].value} />
 * );
 * ```
 */

import React from "react";
import { type SummaryCard as SummaryCardModel, formatTaxValue } from "../../services/taxMapper";

interface SummaryCardProps {
  /**
   * Card data from TaxMapper (never raw API data)
   */
  card: SummaryCardModel;
}

/**
 * Presentational component for a summary card
 * All data is injected, no hardcoding
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ card }) => {
  const toneStyles: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    sky: "text-sky-600 bg-sky-50",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
  };

  const toneStyle = card.tone ? toneStyles[card.tone] : "text-gray-600 bg-gray-50";

  return (
    <div className={`rounded-lg p-4 ${toneStyle}`}>
      <h3 className="text-sm font-medium text-gray-700">{card.label}</h3>
      <p className="text-2xl font-bold mt-2">{formatTaxValue(card.value, "money")}</p>
      {card.meta && <p className="text-xs text-gray-600 mt-1">{card.meta}</p>}
      {card.badge && (
        <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded bg-white bg-opacity-50">
          {card.badge}
        </span>
      )}
    </div>
  );
};

interface TaxSummaryProps {
  /**
   * List of summary cards from mapped data
   */
  cards: SummaryCardModel[];
  isLoading?: boolean;
}

/**
 * Container component displaying summary cards
 * Maps over card data - no loops or transformations
 */
export const TaxSummary: React.FC<TaxSummaryProps> = ({ cards, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg p-4 bg-gray-200 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tax Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <SummaryCard key={index} card={card} />
        ))}
      </div>
    </div>
  );
};
