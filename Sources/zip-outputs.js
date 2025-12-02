const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
    console.error('Dist directory not found');
    process.exit(1);
}

fs.readdir(distDir, (err, files) => {
    if (err) throw err;

    files.forEach(file => {
        if (file.endsWith('.exe') || file.endsWith('.AppImage')) {
            const outputDetails = {
                source: path.join(distDir, file),
                dest: path.join(distDir, `${file}.zip`)
            };

            const output = fs.createWriteStream(outputDetails.dest);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`Created: ${outputDetails.dest}`);
            });

            archive.pipe(output);
            archive.file(outputDetails.source, { name: file });
            archive.finalize();
        }
    });
});