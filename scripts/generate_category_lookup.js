import fs from 'fs';
import path from 'path';

const csvPath = path.resolve(process.cwd(), 'backup/subcategories_rows.csv');
const outputPath = path.resolve(process.cwd(), 'src/lib/categories_subcategories.json');

if (!fs.existsSync(csvPath)) {
    console.error(`Error: Backup file ${csvPath} does not exist.`);
    process.exit(1);
}

try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Header check
    // id,category,name,user_id,household_id
    const lookup = {};

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV splitter that handles potential quotes (though in this file commas are only separators)
        let parts = [];
        let currentPart = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart.trim());

        if (parts.length < 3) continue;

        const category = parts[1];
        const subcategory = parts[2];

        if (!category || !subcategory) continue;

        if (!lookup[category]) {
            lookup[category] = [];
        }
        // Avoid duplicate subcategories
        if (!lookup[category].includes(subcategory)) {
            lookup[category].push(subcategory);
        }
    }

    // Sort categories and subcategories alphabetically for neatness
    const sortedLookup = {};
    const sortedCategories = Object.keys(lookup).sort();
    sortedCategories.forEach(cat => {
        sortedLookup[cat] = lookup[cat].sort();
    });

    fs.writeFileSync(outputPath, JSON.stringify(sortedLookup, null, 2), 'utf-8');
    console.log(`\n✅ Category & Subcategory Lookup Table Created!`);
    console.log(`Saved to: ${outputPath}`);
    console.log(`\nGenerated categories and subcategory counts:`);
    Object.entries(sortedLookup).forEach(([cat, subcats]) => {
        console.log(`- ${cat}: ${subcats.length} subcategories (${subcats.join(', ')})`);
    });

} catch (err) {
    console.error("Failed to generate category lookup:", err);
}
