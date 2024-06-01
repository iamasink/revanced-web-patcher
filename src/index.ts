import express, { Request, Response } from 'express'
import multer from 'multer'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import https from 'https'

const app = express()
const PORT = process.env.PORT || 3000
const UPLOAD_FOLDER = '/usr/src/app/uploads'
const PROCESSED_FOLDER = '/usr/src/app/processed'
console.log(process.env.NODE_ENV)
console.log(process.env.CLIVERSION)
console.log(process.env.PATCHESVERSION)
console.log(process.env.INTEGRATIONSVERSION)
let lastreleasecheck: Date
const REVANCED_CLI_VER: string = process.env.CLIVERSION || "v???"
let latestpatches: string = process.env.PATCHESVERSION || "v???"
let latestintegrations: string = process.env.INTEGRATIONSVERSION || "v???"
let installedpatches = latestpatches
let installedintegrations = latestintegrations
let downloadingrevanced = false

// Set up multer for file uploads
const upload = multer({ dest: UPLOAD_FOLDER })

// Serve static files
console.log(path.join(__dirname, "./public"))
// serve the compiled `dist` files to the client
app.use("/", express.static(path.join(__dirname, "../dist/public")));

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

app.get("/patches/:app?", async (req, res) => {
    const appParam = req.params.app
    console.log(appParam)

    if (downloadingrevanced) {
        res.json({ "error": "downloading patches, please try again later" })
    } else {
        try {
            var fs = require('fs');

            fs.readFile('/patches.json', 'utf8', function (err, data) {
                if (err) throw err; // we'll not consider error handling for now
                const patches = JSON.parse(data);
                if (appParam) {
                    // Filter patches based on the app parameter
                    const filteredPatches = patches.filter(patch => {
                        if (patch.compatiblePackages) return patch.compatiblePackages.some(pkg => pkg.name === appParam)
                        else return true
                    })
                    res.json(filteredPatches);
                } else {
                    // If no app parameter, return all patches
                    res.json(patches);
                }
            });

        } catch (err) {
            console.error('Error reading or parsing patches.json:', err);
            res.status(500).send('Error reading patches');
        }

    }
})
app.get("/apps/:appname?", async (req, res) => {
    const appname = req.params.appname

    if (downloadingrevanced) {
        res.json({ "error": "downloading patches, please try again later" });
    } else {
        try {
            const fs = require('fs').promises;

            const data = await fs.readFile('/patches.json', 'utf8');
            const patches = JSON.parse(data);

            const appsMap = new Map();
            for (const patch of patches) {
                const pkgs = patch.compatiblePackages || [];
                for (const pkg of pkgs) {
                    if (!appsMap.has(pkg.name)) {
                        appsMap.set(pkg.name, { name: pkg.name, versions: pkg.versions });
                    }
                }
            }

            const uniqueApps = Array.from(appsMap.values());

            if (appname) {
                // If appname is provided, find version information for that app
                const versionInfo = uniqueApps.filter(e => e.name === appname).map(e => e.versions)

                if (versionInfo.length === 0) {
                    res.status(404).json({ "error": "App not found" });
                } else {
                    res.json(versionInfo[0]);
                }
            } else {
                // If no appname provided, return information for all apps
                res.json(uniqueApps);
            }
        } catch (err) {
            console.error('Error reading or parsing patches.json:', err);
            res.status(500).send('Error reading patches');
        }
    }
});


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
    // const childProcess = exec("sleep 1")
    const childProcess = exec(command)

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

async function downloadFile(fileName: string, url: string) {
    console.log("downloading file", fileName, url)
    const file = fs.createWriteStream(fileName);
    const request = https.get(url, function (response) {
        response.pipe(file);

        // after download completed close filestream
        file.on("finish", () => {
            file.close();
            console.log("Download Completed");
        });
    });
}

// Endpoint to get the latest release
app.get('/latest-release', async (req: Request, res: Response) => {
    // return res.json({ "patches": latestpatches, "integrations": latestintegrations });


    const now = new Date();
    console.log("checking releases. current time:", now)

    if (!lastreleasecheck || (now.getTime() - lastreleasecheck.getTime()) > 5 * 60 * 1000) {
        console.log("fetching new releases")
        if (!downloadingrevanced) {
            downloadingrevanced = true
            lastreleasecheck = now
            try {
                console.log("fetch!")
                const [newpatches, newintegrations] = await Promise.all([
                    getLatestPatches(),
                    getLatestIntegrations()
                ]);
                console.log("done fetch")
                const downloadPromises: Promise<void>[] = []
                if ("v" + latestpatches != newpatches.tag_name) {
                    console.log("downloading patches")
                    downloadPromises.push(downloadFile("patches.json", newpatches.assets.find((element) => element.name === "patches.json").browser_download_url))
                    const regex = /revanced-patches-.*.jar/g;
                    downloadPromises.push(downloadFile("revanced-patches.jar", newpatches.assets.find((x) => x.name.match(regex)).browser_download_url))
                }
                if ("v" + latestintegrations != newintegrations.tag_name) {
                    const regex = /revanced-integrations-.*.apk/g;
                    downloadPromises.push(downloadFile("revanced-integrations.apk", newpatches.assets.find((x) => x.name.match(regex)).browser_download_url))
                }

                await Promise.all(downloadPromises)

                latestpatches = newpatches.tag_name
                latestintegrations = newintegrations.tag_name


            } catch (error) {
                res.status(500).send('Error fetching latest release');
                return;
            }
            downloadingrevanced = false
        } else console.log("already downloading...")
    }

    res.json({ "patches": latestpatches, "integrations": latestintegrations });
});

// Serve index.html for root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Start server
const server = app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`)
    // console.log(await getLatestPatches())
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




async function getLatestPatches() {
    return (await getLatestRelease("https://api.github.com/repos/ReVanced/revanced-patches/releases/latest"))
}
async function getLatestIntegrations() {
    return (await getLatestRelease("https://api.github.com/repos/ReVanced/revanced-integrations/releases/latest"))
}


async function getLatestRelease(url: string): Promise<any> {
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching release: ${response.statusText}`);
        }

        const release = await response.json();
        return release;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}


type Patches = Patch[]

export interface Patch {
    name: string;
    description: null | string;
    compatiblePackages: CompatiblePackage[] | null;
    use: boolean;
    requiresIntegrations: boolean;
    options: PatchesOption[];
}

export interface CompatiblePackage {
    name: string;
    versions: string[] | null;
}

export interface PatchesOption {
    key: string;
    default: null | string;
    values: { [key: string]: string } | null;
    title: string;
    description: string;
    required: boolean;
}
