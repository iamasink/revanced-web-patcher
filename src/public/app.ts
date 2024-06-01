console.log("hello world")

document.addEventListener("DOMContentLoaded", function (event) {
    console.log("DOMContentLoaded")
    document.getElementById('uploadForm').addEventListener('submit', function (event) {
        event.preventDefault() // Prevent form submission

        const formData = new FormData() // Create FormData object
        const fileInput = document.getElementById('fileInput') as HTMLInputElement // Get file input element
        const form = document.getElementById("uploadForm") as HTMLFormElement
        const button = document.getElementById("fileInputSubmit") as HTMLFormElement
        button.remove()
        // const formDiv = document.getElementById("formdiv") as HTMLDivElement
        // const newelement = document.createElement("div")
        // formDiv.appendChild(newelement)


        // Check if a file is selected
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0] // Get the first file
            formData.append('file', file) // Append file to FormData object

            // Send AJAX request to upload file
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/upload', true)

            xhr.onerror = function (e) {
                console.log("failed " + e)
            }

            xhr.onload = function () {
                if (xhr.status === 200) {
                    console.log('File uploaded successfully')
                    // Parse the JSON response
                    const response = JSON.parse(xhr.responseText)
                    // Connect to the SSE endpoint for processing the file
                    const eventSource = new EventSource(`/process/${response.filename}`)

                    // Function to handle SSE messages
                    const handleMessage = (event: MessageEvent) => {
                        const log = document.getElementById('log') as HTMLDivElement
                        console.log(JSON.stringify(event))
                        console.log(event.data)
                        if (event.data === "close") {
                            log.innerText += "Closing SSE <3" + '\n'
                            const downloadLink = `<a href="/download/${response.filename}">Download Processed File</a>`
                            document.getElementById('downloadLink').innerHTML = downloadLink
                            eventSource.close()
                        } else {
                            log.innerText += event.data + '\n'
                        }
                    }

                    // Attach the message event handler
                    eventSource.onmessage = handleMessage

                    // Handle SSE connection closure
                    eventSource.onerror = (err) => {
                        const log = document.getElementById('log') as HTMLDivElement
                        log.innerText += `Connection to server closed\n${err}\n`
                        eventSource.close()
                    }

                    // Show the loader
                    const loader = '<div class="loader"></div>'
                    document.getElementById('downloadLink').innerHTML = loader

                    // Update the download link once the processing is done
                    eventSource.addEventListener('close', function () {

                    })
                } else {
                    console.error('Error uploading file')
                }
            }

            xhr.send(formData) // Send FormData object
        } else {
            console.error('No file selected')
        }
    })
})
