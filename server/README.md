# Expense Buddy API

Backend API server for the Expense Buddy application using Express.js and SQLite.

## Getting Started

### Start Development Server
```bash
npm run server
```
Server runs on `http://localhost:3001`

### Run Both Frontend and Backend
```bash
npm run dev:fullstack
```

### Build Production Server
```bash
npm run server:build
npm run server:start
```

## Database

- **Type**: SQLite
- **Location**: `server/expenses.db`
- **Tables**:
  - `expenses`: Stores all expense records
  - `subcategories`: Stores custom subcategories per category

## API Endpoints

### Expenses

#### GET `/api/expenses`
Get all expenses ordered by date (descending).

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "amount": 150.50,
    "category": "Groceries",
    "subcategory": "Carrefour",
    "date": "2024-12-23",
    "note": "Weekly shopping",
    "created_at": "2024-12-23T10:30:00.000Z"
  }
]
```

#### GET `/api/expenses/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
Get expenses within a date range.

**Query Parameters**:
- `startDate` (required): Start date in ISO format
- `endDate` (required): End date in ISO format

**Response**: `200 OK` - Array of expenses

#### GET `/api/expenses/category/:category`
Get all expenses for a specific category.

**Response**: `200 OK` - Array of expenses

#### GET `/api/expenses/:id`
Get a single expense by ID.

**Response**: 
- `200 OK` - Expense object
- `404 Not Found` - Expense doesn't exist

#### POST `/api/expenses`
Create a new expense.

**Request Body**:
```json
{
  "amount": 150.50,
  "category": "Groceries",
  "subcategory": "Carrefour",
  "date": "2024-12-23",
  "note": "Weekly shopping"
}
```

**Required Fields**: `amount`, `category`, `date`

**Response**: `201 Created` - Created expense object

#### PUT `/api/expenses/:id`
Update an existing expense.

**Request Body**: Partial expense object (only include fields to update)
```json
{
  "amount": 175.00,
  "note": "Updated amount"
}
```

**Response**: 
- `200 OK` - Updated expense object
- `404 Not Found` - Expense doesn't exist

#### DELETE `/api/expenses/:id`
Delete an expense.

**Response**: 
- `200 OK` - `{ "message": "Expense deleted successfully", "id": "uuid" }`
- `404 Not Found` - Expense doesn't exist

---

### Subcategories

#### GET `/api/subcategories`
Get all subcategories ordered by category and name.

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "category": "Groceries",
    "name": "Carrefour"
  }
]
```

#### GET `/api/subcategories/:category`
Get all subcategories for a specific category.

**Response**: `200 OK` - Array of subcategories

#### POST `/api/subcategories`
Create a new subcategory.

**Request Body**:
```json
{
  "category": "Groceries",
  "name": "New Store"
}
```

**Required Fields**: `category`, `name`

**Response**: 
- `201 Created` - Created subcategory object
- `409 Conflict` - Subcategory already exists for this category

#### DELETE `/api/subcategories/:id`
Delete a subcategory.

**Response**: 
- `200 OK` - `{ "message": "Subcategory deleted successfully", "id": 1 }`
- `404 Not Found` - Subcategory doesn't exist

---

### Statistics

#### GET `/api/stats/by-category?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
Get expense statistics grouped by category.

**Query Parameters** (optional):
- `startDate`: Filter start date
- `endDate`: Filter end date

**Response**: `200 OK`
```json
[
  {
    "category": "Groceries",
    "count": 25,
    "total": 3750.50,
    "average": 150.02,
    "min": 50.00,
    "max": 500.00
  }
]
```

#### GET `/api/stats/monthly`
Get total expenses grouped by month.

**Response**: `200 OK`
```json
[
  {
    "month": "2024-12",
    "count": 45,
    "total": 8500.00
  }
]
```

---

### Health Check

#### GET `/api/health`
Server health check.

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

## Categories

The application supports the following predefined categories:

- **Rent**: No subcategories
- **Groceries**: Dynamic subcategories (Carrefour, Noon, Careem, West Zone, Talabat, Amazon Now, Grandiose, Spinneys, Madhoor, etc.)
- **Shopping**: Clothes, Skincare, Accessories, Miscellaneous
- **Entertainment**: Dine-out, Food Delivery, Activities
- **Utilities**: Cook Salary, Internet, DEWA, Mobile Recharge, Chiller
- **Luxury**: Dynamic subcategories
- **Grooming**: Haircut, and more
- **Transport**: Nol Card, Taxi, and more

Users can add custom subcategories to any category via the API.

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message description"
}
```

Common status codes:
- `400 Bad Request`: Invalid input or missing required fields
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Resource already exists (e.g., duplicate subcategory)
- `500 Internal Server Error`: Server error
