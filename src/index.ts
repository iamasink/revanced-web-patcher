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

// Log requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Handle file upload
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded');
    }

    console.log('File uploaded:', req.file.originalname);
    console.log('File path:', req.file.path);

    const inputFile = req.file.path;
    // Sanitize the filename before using it
    const sanitizedFilename = req.file.originalname.replace(/[^\w.() -]/g, '_');
    const processedFile = path.join(PROCESSED_FOLDER, sanitizedFilename);


    // const command = `java -jar /revanced-cli.jar ${inputFile} -o ${processedFile}`;
    // Run revanced-cli.jar to process the file
    const command = `java -jar /revanced-cli.jar patch ${inputFile} -o ${processedFile} --merge /revanced-integrations.apk --patch-bundle /revanced-patches.jar`;

    console.log('Executing command:', command);

    // Set response headers for SSE
    // res.setHeader('Content-Type', 'text/event-stream');
    // res.setHeader('Cache-Control', 'no-cache');
    // res.setHeader('Connection', 'keep-alive');

    // Start the command execution and pipe the output to the response
    const childProcess = exec(command);
    childProcess.stdout.pipe(res);

    childProcess.stdout.on('data', (data) => {
        console.log(`Command stdout: ${data}`);
    });

    childProcess.stdout.on('end', () => {
        console.log('Command execution finished');
    });

    childProcess.on('error', (error) => {
        console.error(`Error running command: ${error.message}`);
    });

    childProcess.on('exit', (code, signal) => {
        if (code !== 0) {
            console.error(`Command exited with code ${code} and signal ${signal}`);
            // Handle error response
            return res.status(500).send('Error processing file');
        }

        // File processed successfully
        console.log(`File processed: ${processedFile}`);

        // Send JSON response with processed file information
        res.json({ filename: sanitizedFilename, downloadUrl: `/download/${sanitizedFilename}` });
    });
});

// Serve processed file for download
app.get('/download/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const filePath = path.join(PROCESSED_FOLDER, filename);
    console.log('Downloading file:', filePath);
    res.download(filePath, (err) => {
        if (err) {
            console.error(`Error downloading file: ${err.message}`);
            res.status(500).send('Error downloading file');
        } else {
            console.log('File downloaded:', filePath);
        }
    });
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
