import { Home, ShoppingCart, ShoppingBag, Ticket, Zap, Diamond, Scissors, Car, LucideIcon } from "lucide-react";

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
    subcategories: ["Carrefour", "Noon", "Careem", "West Zone", "Talabat", "Amazon Now", "Grandiose", "Spinneys", "Madhoor", "Refund"],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: ShoppingBag,
    color: "hsl(var(--chart-shopping))",
    subcategories: ["Clothes", "Skincare", "Accessories", "Miscellaneous", "Refund"],
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
    subcategories: ["Cook Salary", "Internet", "DEWA", "Mobile Recharge", "Chiller", "Refund"],
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

export const formatCurrency = (amount: number): string => {
  return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getMonthName = (monthIndex: number): string => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[monthIndex];
};

export const getShortMonthName = (monthIndex: number): string => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthIndex];
};

// Generate mock data for demonstration
export const generateMockExpenses = (): Expense[] => {
  const expenses: Expense[] = [];
  const now = new Date();
  
  for (let m = 0; m < 6; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    // Generate 15-25 expenses per month
    const numExpenses = Math.floor(Math.random() * 11) + 15;
    
    for (let i = 0; i < numExpenses; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const day = Math.floor(Math.random() * daysInMonth) + 1;
      const expenseDate = new Date(date.getFullYear(), date.getMonth(), day);
      
      let amount: number;
      switch (category.id) {
        case "rent":
          amount = 8000 + Math.random() * 2000;
          break;
        case "groceries":
          amount = 100 + Math.random() * 500;
          break;
        case "shopping":
          amount = 50 + Math.random() * 800;
          break;
        case "entertainment":
          amount = 50 + Math.random() * 400;
          break;
        case "utilities":
          amount = 100 + Math.random() * 600;
          break;
        case "luxury":
          amount = 200 + Math.random() * 2000;
          break;
        case "grooming":
          amount = 50 + Math.random() * 300;
          break;
        case "transport":
          amount = 30 + Math.random() * 200;
          break;
        default:
          amount = 100 + Math.random() * 500;
      }
      
      const subcategory = category.subcategories 
        ? category.subcategories[Math.floor(Math.random() * category.subcategories.length)]
        : undefined;
      
      expenses.push({
        id: `exp-${m}-${i}`,
        categoryId: category.id,
        subcategory,
        amount: Math.round(amount * 100) / 100,
        date: expenseDate.toISOString(),
      });
    }
  }
  
  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

export const getExpensesByMonth = (expenses: Expense[], year: number, month: number): Expense[] => {
  return expenses.filter(expense => {
    const date = new Date(expense.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
};
