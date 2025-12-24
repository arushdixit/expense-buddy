# Expense Buddy

A personal expense tracking application with a React frontend and Express.js backend.

## Features

- 📊 Track expenses across multiple categories (Rent, Groceries, Shopping, Entertainment, etc.)
- 🏷️ Organize expenses with subcategories
- 🔄 **Edit and delete existing expenses** (Long-press on any expense to see actions)
- 💸 **Refund support** (Add a "Refund" subcategory to automatically record negative amounts)
- 📅 View expenses by month with detailed breakdowns
- 📈 Compare spending across different months
- 📥 **Export expenses to CSV** via the Trends view
- 📤 **One-time CSV import** for historical data transfer
- 💾 Persistent data storage with SQLite database
- 🎨 Beautiful, mobile-friendly UI with Tailwind CSS

## Data Import & Export

### Exporting Data
You can export all your expense data to a CSV file by clicking the **Download Icon** in the header of the **Spending Trends** view. This will download a file named `expenses-export.csv`.

### Importing Historical Data (One-time)
If you have historical data in a CSV file, you can import it directly into the database using the provided import script.

1. Prepare your CSV file with the following headers (or in this order):
   `date,amount,category,subcategory,note`
   Example: `2023-12-01,150.50,Groceries,Carrefour,Weekly groceries`

2. Run the import command:
   ```sh
   npx tsx server/src/import-csv.ts path/to/your/file.csv
   ```


## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd expense-buddy

# Install dependencies
npm install
```

### Running the Application

#### Option 1: Run Both Frontend and Backend (Recommended)
```sh
npm run dev:fullstack
```
This starts:
- Frontend on http://localhost:8080
- Backend API on http://localhost:3001

#### Option 2: Run Separately

**Backend only:**
```sh
npm run server
```

**Frontend only:**
```sh
npm run dev
```

### Other Commands

```sh
# Build for production
npm run build

# Build backend for production
npm run server:build

# Run linting
npm run lint

# Preview production build
npm run preview
```


## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **shadcn-ui** - UI component library
- **Framer Motion** - Animations
- **React Router** - Routing
- **date-fns** - Date utilities
- **Recharts** - Data visualization

### Backend
- **Express.js** - REST API server
- **SQLite** - Database (via better-sqlite3)
- **TypeScript** - Type safety
- **CORS** - Cross-origin resource sharing

## Project Structure

```
expense-buddy/
├── src/                    # Frontend source code
│   ├── components/        # React components
│   │   ├── ui/           # shadcn-ui components
│   │   └── views/        # Main view components
│   ├── context/          # React Context (state management)
│   ├── lib/              # Utilities and API client
│   ├── pages/            # Page components
│   └── App.tsx           # Root component
├── server/                # Backend source code
│   ├── src/
│   │   ├── database.ts   # Database initialization
│   │   └── index.ts      # Express server and API routes
│   ├── expenses.db       # SQLite database (generated)
│   └── README.md         # API documentation
├── public/               # Static assets
└── package.json          # Dependencies and scripts
```

## API Documentation

See [server/README.md](server/README.md) for complete API documentation.

## Integration Guide

See [INTEGRATION.md](INTEGRATION.md) for details on how the frontend and backend are connected.

## Database Schema

### expenses
```sql
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### subcategories
```sql
CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(category, name)
)
```

## Environment Variables

Create a `.env` file in the root directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:3001/api
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
