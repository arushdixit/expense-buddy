import { 
  Home, ShoppingCart, ShoppingBag, Ticket, Zap, Diamond, Scissors, Car, LucideIcon,
  Utensils, Plane, Heart, Gift, Book, Laptop, DollarSign, Coffee, Sparkles, Layers, Coins, Wrench
} from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  subcategories?: string[];
}

export interface Expense {
  id: string;
  categoryId: string;
  subcategory?: string;
  amount: number;
  date: string;
  note?: string;
  createdAt?: string;
}

export interface MonthlyData {
  month: string;
  year: number;
  total: number;
  expenses: Expense[];
}

export const categories: Category[] = [
  {
    id: "rent",
    name: "Rent",
    icon: Home,
    color: "hsl(var(--chart-rent))",
  },
  {
    id: "groceries",
    name: "Groceries",
    icon: ShoppingCart,
    color: "hsl(var(--chart-groceries))",
    subcategories: ["Carrefour", "Noon", "Careem", "West Zone", "Talabat", "Amazon Now", "Grandiose", "Spinneys", "Madhoor", "Convenience", "Refund"],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: ShoppingBag,
    color: "hsl(var(--chart-shopping))",
    subcategories: ["Clothes", "Skincare", "Accessories", "Amazon", "Noon", "Miscellaneous", "Refund"],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: Ticket,
    color: "hsl(var(--chart-entertainment))",
    subcategories: ["Dine-out", "Food Delivery", "Activities", "Refund"],
  },
  {
    id: "utilities",
    name: "Utilities",
    icon: Zap,
    color: "hsl(var(--chart-utilities))",
    subcategories: ["Cook Salary", "Internet", "DEWA", "Mobile Recharge", "Chiller", "Water", "Refund"],
  },
  {
    id: "luxury",
    name: "Luxury",
    icon: Diamond,
    color: "hsl(var(--chart-luxury))",
    subcategories: ["Refund"],
  },
  {
    id: "grooming",
    name: "Grooming",
    icon: Scissors,
    color: "hsl(var(--chart-grooming))",
    subcategories: ["Refund"],
  },
  {
    id: "transport",
    name: "Transport",
    icon: Car,
    color: "hsl(var(--chart-transport))",
    subcategories: ["Refund"],
  },
];

// List of all available icons for custom categories
export const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  Home, ShoppingCart, ShoppingBag, Ticket, Zap, Diamond, Scissors, Car,
  Utensils, Plane, Heart, Gift, Book, Laptop, DollarSign, Coffee, Sparkles, Layers, Coins, Wrench
};

// Custom Category Helper that decodes "color|icon" format and implements smart fallbacks
export function getCategoryIconAndColor(name: string, colorField?: string): { icon: LucideIcon; color: string } {
  let finalColor = colorField || "hsl(var(--chart-5))";
  let iconName = "Layers";

  // Check if colorField has encoded icon: "color|iconName"
  if (colorField && colorField.includes('|')) {
    const parts = colorField.split('|');
    finalColor = parts[0];
    iconName = parts[1];
  } else {
    // Fallback: Smart keyword matching based on the category name
    const lowerName = name.toLowerCase();

    if (lowerName.includes("food") || lowerName.includes("dining") || lowerName.includes("restaurant") || lowerName.includes("eat") || lowerName.includes("cafe")) {
      iconName = "Utensils";
      if (!colorField) finalColor = "hsl(var(--chart-entertainment))";
    } else if (lowerName.includes("coffee") || lowerName.includes("drink") || lowerName.includes("tea") || lowerName.includes("starbucks")) {
      iconName = "Coffee";
      if (!colorField) finalColor = "hsl(var(--chart-entertainment))";
    } else if (lowerName.includes("travel") || lowerName.includes("flight") || lowerName.includes("trip") || lowerName.includes("vacation") || lowerName.includes("hotel") || lowerName.includes("holiday")) {
      iconName = "Plane";
      if (!colorField) finalColor = "hsl(var(--chart-luxury))";
    } else if (lowerName.includes("car") || lowerName.includes("uber") || lowerName.includes("taxi") || lowerName.includes("transport") || lowerName.includes("fuel") || lowerName.includes("petrol") || lowerName.includes("metro")) {
      iconName = "Car";
      if (!colorField) finalColor = "hsl(var(--chart-transport))";
    } else if (lowerName.includes("health") || lowerName.includes("medical") || lowerName.includes("doctor") || lowerName.includes("medicine") || lowerName.includes("gym") || lowerName.includes("fitness") || lowerName.includes("dentist")) {
      iconName = "Heart";
      if (!colorField) finalColor = "hsl(var(--chart-grooming))";
    } else if (lowerName.includes("gift") || lowerName.includes("present") || lowerName.includes("donation") || lowerName.includes("charity")) {
      iconName = "Gift";
      if (!colorField) finalColor = "hsl(var(--chart-shopping))";
    } else if (lowerName.includes("book") || lowerName.includes("education") || lowerName.includes("school") || lowerName.includes("class") || lowerName.includes("course")) {
      iconName = "Book";
      if (!colorField) finalColor = "hsl(var(--chart-utilities))";
    } else if (lowerName.includes("subscription") || lowerName.includes("netflix") || lowerName.includes("spotify") || lowerName.includes("prime") || lowerName.includes("software") || lowerName.includes("app")) {
      iconName = "Laptop";
      if (!colorField) finalColor = "hsl(var(--chart-utilities))";
    } else if (lowerName.includes("salary") || lowerName.includes("income") || lowerName.includes("bonus") || lowerName.includes("investment") || lowerName.includes("dividend")) {
      iconName = "DollarSign";
      if (!colorField) finalColor = "hsl(var(--chart-luxury))";
    } else if (lowerName.includes("bill") || lowerName.includes("fee") || lowerName.includes("tax") || lowerName.includes("dewa") || lowerName.includes("chiller")) {
      iconName = "Coins";
      if (!colorField) finalColor = "hsl(var(--chart-utilities))";
    } else if (lowerName.includes("home") || lowerName.includes("rent") || lowerName.includes("house") || lowerName.includes("stay") || lowerName.includes("maintenance") || lowerName.includes("repair") || lowerName.includes("plumber")) {
      iconName = "Wrench";
      if (!colorField) finalColor = "hsl(var(--chart-rent))";
    } else if (lowerName.includes("groceries") || lowerName.includes("supermarket") || lowerName.includes("carrefour")) {
      iconName = "ShoppingCart";
      if (!colorField) finalColor = "hsl(var(--chart-groceries))";
    } else if (lowerName.includes("shopping") || lowerName.includes("clothes") || lowerName.includes("mall")) {
      iconName = "ShoppingBag";
      if (!colorField) finalColor = "hsl(var(--chart-shopping))";
    } else if (lowerName.includes("grooming") || lowerName.includes("salon") || lowerName.includes("barber") || lowerName.includes("hair")) {
      iconName = "Scissors";
      if (!colorField) finalColor = "hsl(var(--chart-grooming))";
    } else if (lowerName.includes("misc") || lowerName.includes("other") || lowerName.includes("general")) {
      iconName = "Sparkles";
    }
  }

  const resolvedIcon = AVAILABLE_ICONS[iconName] || Layers;
  return { icon: resolvedIcon, color: finalColor };
}

export const formatCurrency = (amount: number): string => {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formattedAmount = Math.round(absAmount).toLocaleString('en-US');
  return `${isNegative ? '-' : ''}ê ${formattedAmount}`;
};

export const getMonthName = (monthIndex: number): string => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[monthIndex];
};

export const getShortMonthName = (monthIndex: number): string => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthIndex];
};

export const getCategoryById = (id: string, customCategories: Category[] = []): Category | undefined => {
  const allCategories = [...categories, ...customCategories];
  return allCategories.find(cat => cat.id === id);
};

export const calculateCategoryTotals = (expenses: Expense[]): Record<string, number> => {
  return expenses.reduce((acc, expense) => {
    acc[expense.categoryId] = (acc[expense.categoryId] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);
};

export const calculateSubcategoryTotals = (expenses: Expense[]): Record<string, number> => {
  return expenses.reduce((acc, expense) => {
    const key = expense.subcategory || "Other";
    acc[key] = (acc[key] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);
};

export const getExpensesByMonth = (expenses: Expense[], year: number, month: number): Expense[] => {
  return expenses.filter(expense => {
    const parts = expense.date.split('-');
    if (parts.length !== 3) return false;
    const expYear = parseInt(parts[0], 10);
    const expMonth = parseInt(parts[1], 10) - 1; // Convert 1-12 to 0-11 index
    return expYear === year && expMonth === month;
  });
};
