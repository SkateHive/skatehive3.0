export const formatBalance = (balance: number): string => {
  return balance.toFixed(4).replace(/\.?0+$/, "");
};

export const formatValue = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export const formatPrice = (price: number | string | undefined | null): string => {
  // Handle null/undefined
  if (price == null) {
    return "N/A";
  }

  // Convert string to number if needed
  const numPrice = typeof price === "string" ? parseFloat(price) : price;

  // Check if it's a valid number
  if (typeof numPrice !== "number" || isNaN(numPrice)) {
    return "N/A";
  }

  // Smart decimal formatting based on price magnitude
  let decimals: number;

  if (numPrice >= 1000) {
    // For prices $1000+: show 2 decimals (e.g., $1,234.56)
    decimals = 2;
  } else if (numPrice >= 1) {
    // For prices $1-$999: show 3 decimals (e.g., $123.456)
    decimals = 3;
  } else if (numPrice >= 0.01) {
    // For prices $0.01-$0.99: show 4 decimals (e.g., $0.1234)
    decimals = 4;
  } else if (numPrice >= 0.001) {
    // For prices $0.001-$0.009: show 5 decimals (e.g., $0.01234)
    decimals = 5;
  } else if (numPrice >= 0.0001) {
    // For prices $0.0001-$0.0009: show 6 decimals (e.g., $0.012345)
    decimals = 6;
  } else {
    // For very small prices: show 8 decimals (e.g., $0.00001234)
    decimals = 8;
  }

  // Format with appropriate decimals and add thousand separators for large numbers
  if (numPrice >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numPrice);
  } else {
    return `$${numPrice.toFixed(decimals)}`;
  }
};

export const formatPriceChange = (priceChange: number | undefined | null): string => {
  if (typeof priceChange !== "number" || isNaN(priceChange)) {
    return "0.00";
  }
  return priceChange.toFixed(2);
};
