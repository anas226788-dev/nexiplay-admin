const fs = require('fs');

const code = fs.readFileSync('d:/nexiplay-admin-main/src/components/admin/MovieForm.tsx', 'utf8');

// Find all occurrences of the "downloads" variable
const lines = code.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('downloads') && !line.includes('download_links') && !line.includes('initialData?.downloads')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
