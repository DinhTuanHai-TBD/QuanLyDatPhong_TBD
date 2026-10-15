const fs = require('fs');

function findFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(findFiles(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = findFiles('./src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let updated = content.replace(/(<Alert[^>]*?)message=/gs, "$1title=");
    if (updated !== content) {
        fs.writeFileSync(file, updated);
        console.log("Updated", file);
    }
});
