console.log("hello world")

document.addEventListener("DOMContentLoaded", async function (event) {
    console.log("DOMContentLoaded")
    const releaseInfo = document.getElementById('releaseInfo')

    try {
        const response = await fetch('/latest-release')
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        const data = await response.json()
        releaseInfo.innerHTML = `<p>Latest patches: ${data.patches}</p>
        <p>Latest integrations: ${data.integrations}</p>`
    } catch (error) {
        releaseInfo.innerHTML = `<p>Error loading latest release: ${error.message}</p>`
    }
    try {

    } catch (error) {
        releaseInfo.innerHTML = `<p>Error loading latest release: ${error.message}</p>`
    }

    const apkDropdown = document.getElementById('apkoptions')
    const fileInput = document.getElementById('fileInput') as HTMLInputElement // Get file input element
    const apps: { name: string, versions: any }[] = await (await fetch('/apps')).json()
    console.log("apps")
    console.log(apps)

    for (let i = 0, len = apps.length; i < len; i++) {
        const opt = document.createElement('option')
        opt.value = apps[i].name
        opt.innerHTML = apps[i].name
        apkDropdown.appendChild(opt)
    }
    apkDropdown.removeAttribute("disabled")
    apkDropdown.onchange = async (event: Event) => {
        // When an APK has been selected from the dropdown

        console.log(event)
        const appName = (event.target as HTMLSelectElement).value
        console.log("Selected value:", appName)
        const patchesDiv = document.getElementById('patchoptions')
        const patches = await (await fetch(`/patches/${appName}`)).json()
        // const patches = fetchedpatches.map(e => `${e.name} - ${e.description}`)
        patchesDiv.innerHTML = ""

        // fetch suggested version and add search button
        const suggestedVersionText = (document.getElementById('suggestedVersionText') as HTMLParagraphElement)
        const suggestedVersionLink = (document.getElementById('suggestedVersionLink') as HTMLAnchorElement)
        const suggestedVer = (await (await fetch(`/suggestedversion/${appName}`)).json()).suggestedVersions.pop()
        console.log(suggestedVer)
        suggestedVersionText.textContent = `Suggested Version: v${suggestedVer}`
        suggestedVersionLink.href = `https://duckduckgo.com/?q=${appName} apk version ${suggestedVer}`


        // loop through compatible patches and display them to the user in a form
        for (let i = 0, len = patches.length; i < len; i++) {
            const p = patches[i]

            const patchdiv = document.createElement('div')

            // Create a checkbox element
            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.id = 'patch_' + i // Unique ID for each checkbox
            checkbox.value = p.name // Set the value of the checkbox to the patch name

            // Create a label for the checkbox
            const label = document.createElement('label')
            label.htmlFor = 'patch_' + i // Associate label with checkbox
            label.appendChild(document.createTextNode(`${p.use ? "⭕" : ""} ${p.name} ${p.options.length ? "⚙️" : ""}`)) // Add patch name as label text
            label.appendChild(document.createElement('br')) // Add line break
            label.appendChild(document.createTextNode(p.description)) // Add patch desc

            const optionsdiv = document.createElement('div')


            // Add event listener to checkbox
            checkbox.addEventListener('change', (event) => {
                const target = event.target as HTMLInputElement
                if (target.checked) {
                    createOptionsUI(p, optionsdiv) // Create options UI when checkbox is checked
                } else {
                    // Clear options UI when checkbox is unchecked
                    optionsdiv.innerHTML = ''
                }
            })

            // Append checkbox and label to patchesDiv
            patchdiv.appendChild(checkbox)
            patchdiv.appendChild(label)
            patchdiv.appendChild(optionsdiv)
            patchdiv.appendChild(document.createElement('br')) // Add line break

            patchesDiv.appendChild(patchdiv)

            if (p.use) {
                checkbox.checked = true
            }
        }
    }

    fileInput.onchange = async (event) => {
        const target = event.target as HTMLInputElement
        let filename = target.value
        filename = filename.slice(0, filename.indexOf("_"))

        console.log(event)
        let appname: string

        let result = findBestMatch(filename, apps.map(e => e.name)).ratings.sort((a, b) => b.rating - a.rating)
        console.log(result)

        apkDropdown.innerHTML = ""
        let option = document.createElement('option')
        option.value = "Choose an APK to patch"
        option.innerHTML = "Choose an APK to patch"
        apkDropdown.appendChild(option)

        for (let i = 0, len = result.length; i < len; i++) {
            const name = result[i].target
            const opt = document.createElement('option')
            opt.value = name
            opt.innerHTML = name
            apkDropdown.appendChild(opt)
        }
    }


    document.getElementById('uploadForm').addEventListener('submit', async function (event) {
        // when submit button pressed 

        event.preventDefault() // Prevent form submission


        const formData = new FormData() // Create FormData object
        const fileInput = document.getElementById('fileInput') as HTMLInputElement // Get file input element
        const apkDropdown = document.getElementById('apkoptions') as HTMLSelectElement // Get APK dropdown
        const selectedApp = apkDropdown.value // Get selected APK name

        const optionsdiv = document.getElementById("optionsDiv")
        const submitbutton = document.getElementById("fileInputSubmit")
        optionsdiv.remove()
        submitbutton.remove()


        const selectedPatches: { name: string; options: { [key: string]: string } }[] = [] // Array to store selected patches and their options

        // Loop through patch checkboxes to get selected patches
        const patchCheckboxes = document.querySelectorAll('input[type="checkbox"]')
        for (const checkbox of Array.from(patchCheckboxes)) {
            if ((checkbox as HTMLInputElement).checked) {
                const patchName = (checkbox as HTMLInputElement).value
                const optionsDiv = (checkbox.parentElement as HTMLDivElement).querySelector('div')
                const options: { [key: string]: string } = {}

                // If options are present, gather selected option values
                if (optionsDiv) {
                    const optionInputs = optionsDiv.querySelectorAll('input, select')
                    for (const input of Array.from(optionInputs)) {
                        options[(input as HTMLInputElement).name] = (input as HTMLInputElement).value
                    }
                }

                selectedPatches.push({ name: patchName, options })
            }
        }

        // Add file and selected options to FormData
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0]
            formData.append('file', file)
        }

        // Append selected app and patches to FormData
        formData.append('app', selectedApp)
        formData.append('patches', JSON.stringify(selectedPatches))

        try {
            // upload file and selected options
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            })

            if (response.ok) {
                console.log('File and selected options uploaded successfully')
                console.log(response)
                const responsedata = await response.json()
                console.log(responsedata)
                const appName = responsedata.originalname
                // handle log 

                const url = new URL(window.location.href)
                url.searchParams.set("file", responsedata.filename)
                history.pushState({}, "", url)

                const outputElement = document.getElementById('log')
                const log = document.getElementById('log') as HTMLDivElement

                // Function to handle SSE messages
                const handleMessage = (event: MessageEvent) => {
                    console.log(JSON.stringify(event))
                    console.log(event.data)
                    if (event.data === "close") {
                        log.innerText += "Closing SSE <3" + '\n'
                        const downloadLink = `<a href="/download/${responsedata.filename}${appName ? "?name=revanced-" + appName : ""}}">Download Processed File</a>`
                        document.getElementById('downloadLink').innerHTML = downloadLink
                        eventSource.close()
                    } else {
                        log.innerText += event.data + '\n'
                    }
                }

                // Connect to the SSE endpoint
                const eventSource = new EventSource(`/process/${await responsedata.filename}`)

                // Attach the message event handler
                eventSource.onmessage = handleMessage

                // Handle SSE connection closure
                eventSource.onerror = (err) => {
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
                console.error('Error uploading file and selected options')
            }
        } catch (error) {
            console.error('Error uploading file and selected options:', error)
        }
    })
})




// Interface for patch option
interface PatchOption {
    key: string
    default: string
    values?: { [key: string]: string }
    title: string
    description: string
    required: boolean
}

// Interface for patch
interface Patch {
    name: string
    description: string
    compatiblePackages: { name: string, versions: string[] | null }[]
    use: boolean
    requiresIntegrations: boolean
    options: PatchOption[]
}

// Function to create options UI for a patch
function createOptionsUI(patch: Patch, patchoptionsdiv) {
    // const patchoptionsdiv = document.getElementById('optionsDiv');
    patchoptionsdiv.innerHTML = '' // Clear previous options
    const apkinfo = document.createElement('label')
    apkinfo.innerText = `Suggested Version:`
    patchoptionsdiv.appendChild(apkinfo)

    // Loop through the options of the patch
    for (const option of patch.options) {
        // Create label for the option
        const label = document.createElement('label')
        label.innerText = `${option.title}: ${option.description}`
        patchoptionsdiv.appendChild(label)
        patchoptionsdiv.appendChild(document.createElement('br')) // Add line break

        // Create input element based on option type
        if (option.values && !option.values.Default) {
            const select = document.createElement('select')
            select.name = option.key
            select.id = option.key
            // Populate select with option values
            for (const [key, value] of Object.entries(option.values)) {
                const optionElement = document.createElement('option')
                optionElement.value = value
                optionElement.text = key
                select.appendChild(optionElement)
            }
            patchoptionsdiv.appendChild(select)
        } else {
            const input = document.createElement('input')
            input.type = 'text'
            input.name = option.key
            input.id = option.key
            patchoptionsdiv.appendChild(input)
        }

        patchoptionsdiv.appendChild(document.createElement('br')) // Add line break
    }
}

// https://github.com/aceakash/string-similarity/blob/master/src/index.js
function compareTwoStrings(first: string, second: string) {
    first = first.replace(/\s+/g, '')
    second = second.replace(/\s+/g, '')

    if (first === second) return 1 // identical or empty
    if (first.length < 2 || second.length < 2) return 0 // if either is a 0-letter or 1-letter string

    let firstBigrams = new Map()
    for (let i = 0; i < first.length - 1; i++) {
        const bigram = first.substring(i, i + 2)
        const count = firstBigrams.has(bigram)
            ? firstBigrams.get(bigram) + 1
            : 1

        firstBigrams.set(bigram, count)
    };

    let intersectionSize = 0
    for (let i = 0; i < second.length - 1; i++) {
        const bigram = second.substring(i, i + 2)
        const count = firstBigrams.has(bigram)
            ? firstBigrams.get(bigram)
            : 0

        if (count > 0) {
            firstBigrams.set(bigram, count - 1)
            intersectionSize++
        }
    }

    return (2.0 * intersectionSize) / (first.length + second.length - 2)
}

function findBestMatch(mainString: string, targetStrings: string[]) {
    // if (!areArgsValid(mainString, targetStrings)) throw new Error('Bad arguments: First argument should be a string, second should be an array of strings')

    const ratings: { target: string, rating: number }[] = []
    let bestMatchIndex = 0

    for (let i = 0; i < targetStrings.length; i++) {
        const currentTargetString = targetStrings[i]
        const currentRating = compareTwoStrings(mainString, currentTargetString)
        ratings.push({ target: currentTargetString, rating: currentRating })
        if (currentRating > ratings[bestMatchIndex].rating) {
            bestMatchIndex = i
        }
    }


    const bestMatch = ratings[bestMatchIndex]

    return { ratings: ratings, bestMatch: bestMatch, bestMatchIndex: bestMatchIndex }
}