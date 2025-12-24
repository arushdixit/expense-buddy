import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    // Handles "Nov 2025" -> "2025-11-01"
    const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const parts = dateStr.trim().split(/\s+/);
    if (parts.length !== 2) return null;

    const month = months[parts[0].toLowerCase().substring(0, 3)];
    const year = parts[1];

    if (!month || !year) return null;
    return `${year}-${month}-01`;
}

async function importCSV(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    console.log(`Importing from ${filePath}...`);

    const insertStmt = db.prepare(`
    INSERT INTO expenses (id, amount, category, subcategory, date, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    let importedCount = 0;
    let skippedCount = 0;

    const transaction = db.transaction((rows: string[][]) => {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 2) continue; // Skip empty lines

            // Mapping: Date, Amount, SubCategory (desc), Category
            const [dateRaw, amountStr, subName, catNameRaw] = row.map(v => v?.trim() || '');

            const amount = parseFloat(amountStr);
            const date = parseDate(dateRaw);

            // If Category is empty, use the 3rd column. Otherwise use Category.
            let category = catNameRaw || subName;
            let subcategory = catNameRaw ? subName : null;

            if (isNaN(amount) || !category || !date) {
                skippedCount++;
                continue;
            }

            const id = randomUUID();
            try {
                insertStmt.run(id, amount, category, subcategory, date, null);
                importedCount++;
            } catch (err) {
                console.error(`Error importing row ${i + 2}: ${JSON.stringify(row)}`, err);
                skippedCount++;
            }
        }
    });

    const dataRows = lines.slice(1).filter(l => l.trim()).map(line => {
        // Simple split for this data
        return line.split(',').map(s => s.trim());
    });

    transaction(dataRows);

    console.log(`Import complete!`);
    console.log(`Successfully imported: ${importedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: npx tsx server/src/import-csv.ts <path-to-csv>');
} else {
    importCSV(path.resolve(args[0]));
}
