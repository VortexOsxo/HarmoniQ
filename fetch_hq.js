const fs = require('fs');

async function main() {
    try {
        const response = await fetch('https://www.hydroquebec.com/production/centrales.html', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        const html = await response.text();
        const matches = html.match(/\/themes\/[^"']*\.jpg/g) || [];
        const unique = [...new Set(matches)];
        console.log(`Found ${unique.length} matches`);
        fs.writeFileSync('hq_images_raw.json', JSON.stringify(unique, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
