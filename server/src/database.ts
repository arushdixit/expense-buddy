import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'expenses.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Create expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create subcategories table for dynamic subcategory additions
  db.exec(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(category, name)
    )
  `);

  // Seed predefined subcategories
  const seedSubcategories = db.prepare(`
    INSERT OR IGNORE INTO subcategories (category, name) VALUES (?, ?)
  `);

  const predefinedSubcategories = [
    // Groceries
    { category: 'Groceries', name: 'Carrefour' },
    { category: 'Groceries', name: 'Noon' },
    { category: 'Groceries', name: 'Careem' },
    { category: 'Groceries', name: 'West Zone' },
    { category: 'Groceries', name: 'Talabat' },
    { category: 'Groceries', name: 'Amazon Now' },
    { category: 'Groceries', name: 'Grandiose' },
    { category: 'Groceries', name: 'Spinneys' },
    { category: 'Groceries', name: 'Madhoor' },

    { category: 'Groceries', name: 'Refund' },

    // Shopping
    { category: 'Shopping', name: 'Clothes' },
    { category: 'Shopping', name: 'Skincare' },
    { category: 'Shopping', name: 'Accessories' },
    { category: 'Shopping', name: 'Miscellaneous' },
    { category: 'Shopping', name: 'Refund' },

    // Entertainment
    { category: 'Entertainment', name: 'Dine-out' },
    { category: 'Entertainment', name: 'Food Delivery' },
    { category: 'Entertainment', name: 'Activities' },
    { category: 'Entertainment', name: 'Refund' },

    // Utilities
    { category: 'Utilities', name: 'Cook Salary' },
    { category: 'Utilities', name: 'Internet' },
    { category: 'Utilities', name: 'DEWA' },
    { category: 'Utilities', name: 'Mobile Recharge' },
    { category: 'Utilities', name: 'Chiller' },
    { category: 'Utilities', name: 'Refund' },

    // Grooming
    { category: 'Grooming', name: 'Haircut' },
    { category: 'Grooming', name: 'Refund' },

    // Transport
    { category: 'Transport', name: 'Nol Card' },
    { category: 'Transport', name: 'Taxi' },
    { category: 'Transport', name: 'Refund' },

    // Luxury
    { category: 'Luxury', name: 'Refund' },
  ];

  const insertMany = db.transaction((items: Array<{ category: string; name: string }>) => {
    for (const item of items) {
      seedSubcategories.run(item.category, item.name);
    }
  });

  insertMany(predefinedSubcategories);

  console.log('Database initialized successfully');
}

// Initialize on module load
initializeDatabase();

export default db;
