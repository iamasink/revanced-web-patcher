import express, { Request, Response } from 'express'
import multer from 'multer'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

const app = express()
const PORT = process.env.PORT || 3000
const UPLOAD_FOLDER = '/usr/src/app/uploads'
const PROCESSED_FOLDER = '/usr/src/app/processed'

// Set up multer for file uploads
const upload = multer({ dest: UPLOAD_FOLDER })

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Log requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error('No file uploaded')
        return res.status(400).send('No file uploaded')
    }

    console.log('File uploaded:', req.file.originalname)
    console.log('File path:', req.file.path)

    // Respond with uploaded file details
    res.json({ filename: req.file.filename, originalname: req.file.originalname })
})

// Process the uploaded file
app.get('/process/:filename', (req, res) => {
    const filename = req.params.filename
    const inputFile = path.join(UPLOAD_FOLDER, filename)

    if (!fs.existsSync(inputFile)) {
        return res.status(404).send('File not found')
    }

    // Set response headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Sanitize the filename before using it
    const sanitizedFilename = filename.replace(/[^\w.() -]/g, '_')
    const processedFile = path.join(PROCESSED_FOLDER, sanitizedFilename)
    const command = `java -jar /revanced-cli.jar patch ${inputFile} -o ${processedFile} --merge /revanced-integrations.apk --patch-bundle /revanced-patches.jar`

    // Start the command execution and pipe the output to the response
    const childProcess = exec("sleep 1")

    childProcess.stdout?.on('data', (data) => {
        console.log(`Command stdout: ${data}`)
        res.write(`data: ${data}\n\n`)
    })

    childProcess.stderr?.on('data', (data) => {
        console.error(`Command stderr: ${data}`)
        res.write(`data: ${data}\n\n`)
    })

    // Handle command completion and errors https://stackoverflow.com/questions/6534572/how-to-close-a-server-sent-events-connection-on-the-server
    childProcess.on('exit', (code, signal) => {


        if (code !== 0) {
            res.write(`data: Command exited with code ${code} and signal ${signal}\n\n`)
            res.end() // End the SSE stream
        } else {
            res.write('data: Command execution finished\n\n')
            res.write("data: close\n\n")
            let manualShutdown
            res.on("close", () => {
                console.log('disconnected.')
                clearTimeout(manualShutdown)  // prevent shutting down the connection twice
            })

            setTimeout(() => {
                // give it a safe buffer of time before we shut it down manually
                manualShutdown = setTimeout(() => res.end("data: The client didn't shut down properly!"), 10000)
            }, 1000)
        }
    })

    childProcess.on('error', (error) => {
        res.write(`data: Error running command: ${error.message}\n\n`)
        res.end() // End the SSE stream
    })
})

// Serve processed file for download
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename
    const filePath = path.join(PROCESSED_FOLDER, filename)

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found')
    }

    console.log('Downloading file:', filePath)
    res.download(filePath, (err) => {
        if (err) {
            console.error(`Error downloading file: ${err.message}`)
            res.status(500).send('Error downloading file')
        } else {
            console.log('File downloaded:', filePath)
        }
    })
})

// Serve index.html for root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})

// Handle shutdown signals
process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Closing server gracefully...')
    server.close(() => {
        console.log('Server closed gracefully. Exiting process.')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('Received SIGINT signal. Closing server gracefully...')
    server.close(() => {
        console.log('Server closed gracefully. Exiting process.')
        process.exit(0)
    })
})
