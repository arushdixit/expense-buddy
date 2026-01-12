/**
 * Migration Script: SQLite to Supabase
 * 
 * This script migrates your existing SQLite expenses data to Supabase.
 * 
 * Prerequisites:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Run the supabase-schema.sql in your Supabase SQL Editor
 * 3. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 * 
 * Usage:
 *   SUPABASE_URL=your-url SUPABASE_SERVICE_KEY=your-service-key npx tsx scripts/migrate-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use SERVICE key for migrations (has full access)

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables!');
    console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    console.error('');
    console.error('   Usage:');
    console.error('   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... npx tsx scripts/migrate-to-supabase.ts');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SqliteExpense {
    id: string;
    amount: number;
    category: string;
    subcategory: string | null;
    date: string;
    note: string | null;
    created_at: string | null;
    updated_at: number | null;
}

async function migrateExpenses() {
    console.log('🚀 Starting migration to Supabase...\n');

    // Read exported JSON data
    const dataPath = path.join(__dirname, '..', '..', 'tmp', 'expenses_data.json');

    // Try to read from /tmp first (where we exported it)
    let expenses: SqliteExpense[] = [];

    try {
        const data = fs.readFileSync('/tmp/expenses_data.json', 'utf-8');
        expenses = JSON.parse(data);
        console.log(`📦 Found ${expenses.length} expenses to migrate\n`);
    } catch (error) {
        console.error('❌ Could not read expenses data from /tmp/expenses_data.json');
        console.error('   Please run the export command first:');
        console.error('   sqlite3 server/expenses.db "SELECT json_group_array(...) FROM expenses;" > /tmp/expenses_data.json');
        process.exit(1);
    }

    // Transform data for Supabase
    const supabaseExpenses = expenses.map(exp => ({
        id: exp.id,
        amount: exp.amount,
        category: exp.category,
        subcategory: exp.subcategory,
        date: exp.date,
        note: exp.note,
        created_at: exp.created_at || new Date().toISOString(),
        updated_at: exp.updated_at || Date.now(),
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < supabaseExpenses.length; i += batchSize) {
        const batch = supabaseExpenses.slice(i, i + batchSize);

        const { data, error } = await supabase
            .from('expenses')
            .upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
            errorCount += batch.length;
        } else {
            insertedCount += batch.length;
            console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${insertedCount}/${supabaseExpenses.length})`);
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${insertedCount} expenses`);
    if (errorCount > 0) {
        console.log(`   ❌ Errors: ${errorCount} expenses`);
    }

    // Verify the migration
    const { count, error: countError } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true });

    if (!countError) {
        console.log(`   📈 Total expenses in Supabase: ${count}`);
    }

    console.log('\n✨ Migration complete!');
}

migrateExpenses().catch(console.error);
