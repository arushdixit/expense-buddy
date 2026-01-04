import express, { Request, Response } from 'express';
import cors from 'cors';
import db from './database.js';
import { randomUUID } from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface Expense {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  note?: string;
  created_at?: string;
}

interface Subcategory {
  id: number;
  category: string;
  name: string;
}

// ============= EXPENSE ENDPOINTS =============

// GET all expenses
app.get('/api/expenses', (req: Request, res: Response) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET expenses by date range
app.get('/api/expenses/range', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const expenses = db.prepare(
      'SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC'
    ).all(startDate, endDate);

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses by range:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET expenses by category
app.get('/api/expenses/category/:category', (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const expenses = db.prepare(
      'SELECT * FROM expenses WHERE category = ? ORDER BY date DESC'
    ).all(category);

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses by category:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET single expense by ID
app.get('/api/expenses/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// POST create new expense
app.post('/api/expenses', (req: Request, res: Response) => {
  try {
    const { amount, category, subcategory, date, note } = req.body;

    // Validation
    if (!amount || !category || !date) {
      return res.status(400).json({
        error: 'Missing required fields: amount, category, and date are required'
      });
    }

    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ error: 'Amount must be a non-zero number' });
    }

    const id = randomUUID();

    const stmt = db.prepare(`
      INSERT INTO expenses (id, amount, category, subcategory, date, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(id, amount, category, subcategory || null, date, note || null);

    if (result.changes === 0) {
      return res.status(500).json({ error: 'Failed to create expense' });
    }

    const newExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT update expense
app.put('/api/expenses/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, category, subcategory, date, note } = req.body;

    // Check if expense exists
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Validation
    if (amount !== undefined && (typeof amount !== 'number' || amount === 0)) {
      return res.status(400).json({ error: 'Amount must be a non-zero number' });
    }

    const stmt = db.prepare(`
      UPDATE expenses 
      SET amount = COALESCE(?, amount),
          category = COALESCE(?, category),
          subcategory = ?,
          date = COALESCE(?, date),
          note = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      amount || null,
      category || null,
      subcategory !== undefined ? subcategory : (existing as any).subcategory,
      date || null,
      note !== undefined ? note : (existing as any).note,
      id
    );

    if (result.changes === 0) {
      return res.status(500).json({ error: 'Failed to update expense' });
    }

    const updatedExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE expense
app.delete('/api/expenses/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully', id });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ============= SUBCATEGORY ENDPOINTS =============

// GET all subcategories
app.get('/api/subcategories', (req: Request, res: Response) => {
  try {
    const subcategories = db.prepare('SELECT * FROM subcategories ORDER BY category, name').all();
    res.json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// GET subcategories by category
app.get('/api/subcategories/:category', (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const subcategories = db.prepare(
      'SELECT * FROM subcategories WHERE category = ? ORDER BY name'
    ).all(category);

    res.json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// POST create new subcategory
app.post('/api/subcategories', (req: Request, res: Response) => {
  try {
    const { category, name } = req.body;

    if (!category || !name) {
      return res.status(400).json({
        error: 'Missing required fields: category and name are required'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO subcategories (category, name) VALUES (?, ?)
    `);

    try {
      const result = stmt.run(category, name);

      const newSubcategory = db.prepare(
        'SELECT * FROM subcategories WHERE id = ?'
      ).get(result.lastInsertRowid);

      res.status(201).json(newSubcategory);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({
          error: 'Subcategory already exists for this category'
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// DELETE subcategory
app.delete('/api/subcategories/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM subcategories WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json({ message: 'Subcategory deleted successfully', id });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

// ============= STATISTICS ENDPOINTS =============

// GET expense statistics by category
app.get('/api/stats/by-category', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average,
        MIN(amount) as min,
        MAX(amount) as max
      FROM expenses
    `;

    const params: string[] = [];
    if (startDate && endDate) {
      query += ' WHERE date BETWEEN ? AND ?';
      params.push(startDate as string, endDate as string);
    }

    query += ' GROUP BY category ORDER BY total DESC';

    const stats = db.prepare(query).all(...params);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET monthly expense totals
app.get('/api/stats/monthly', (req: Request, res: Response) => {
  try {
    const stats = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
    `).all();

    res.json(stats);
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET export all expenses as CSV
app.get('/api/export', (req: Request, res: Response) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all() as Expense[];

    // Create CSV header
    let csv = 'ID,Date,Amount,Category,Subcategory,Note,CreatedAt\n';

    // Add rows
    expenses.forEach(exp => {
      const row = [
        exp.id,
        exp.date,
        exp.amount,
        `"${exp.category.replace(/"/g, '""')}"`,
        exp.subcategory ? `"${exp.subcategory.replace(/"/g, '""')}"` : '',
        exp.note ? `"${exp.note.replace(/"/g, '""')}"` : '',
        exp.created_at || ''
      ].join(',');
      csv += row + '\n';
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('expenses-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting expenses:', error);
    res.status(500).json({ error: 'Failed to export expenses' });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://192.168.3.27:${PORT}`);
  console.log(`📊 API endpoints available at http://192.168.3.27:${PORT}/api`);
});

