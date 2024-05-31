import express, { Request, Response } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_FOLDER = '/src/user/app/uploads';
const PROCESSED_FOLDER = '/src/user/app/processed';

// Set up multer for file uploads
const upload = multer({ dest: UPLOAD_FOLDER });

// Serve static files
app.use(express.static('public'));

// Handle file upload
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    // Run revanced-cli.jar to process the file
    const inputFile = req.file.path;
    // Sanitize the filename before using it
    const sanitizedFilename = req.file.originalname.replace(/[^\w.-()]/g, '_');
    const processedFile = path.join(PROCESSED_FOLDER, 'processed_' + sanitizedFilename);
    const command = `java -jar revanced-cli.jar ${inputFile} -o ${processedFile}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running command: ${error.message}`);
            return res.status(500).send('Error processing file');
        }

        // File processed successfully
        console.log(`File processed: ${processedFile}`);
        res.sendFile(path.join(__dirname, 'public', 'processed.html'));
    });
});

// Serve processed file for download
app.get('/download/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const filePath = path.join(PROCESSED_FOLDER, filename);
    res.download(filePath);
});

// Serve index.html for root URL
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Closing server gracefully...');
    server.close(() => {
        console.log('Server closed gracefully. Exiting process.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal. Closing server gracefully...');
    server.close(() => {
        console.log('Server closed gracefully. Exiting process.');
        process.exit(0);
    });
});
