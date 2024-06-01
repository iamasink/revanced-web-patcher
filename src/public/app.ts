console.log("hello world")

document.addEventListener("DOMContentLoaded", async function (event) {
    console.log("DOMContentLoaded")
    const releaseInfo = document.getElementById('releaseInfo');

    try {
        const response = await fetch('/latest-release');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        releaseInfo.innerHTML = `<p>Latest patches: ${data.patches}</p>
        <p>Latest integrations: ${data.integrations}</p>`;
    } catch (error) {
        releaseInfo.innerHTML = `<p>Error loading latest release: ${error.message}</p>`;
    }
    try {

    } catch (error) {
        releaseInfo.innerHTML = `<p>Error loading latest release: ${error.message}</p>`;
    }

    const apkDropdown = document.getElementById('apkoptions')
    const apps = await (await fetch('/apps')).json()
    console.log("apps")
    console.log(apps)

    for (let i = 0, len = apps.length; i < len; i++) {
        const opt = document.createElement('option');
        opt.value = apps[i].name;
        opt.innerHTML = apps[i].name;
        apkDropdown.appendChild(opt);
    }
    apkDropdown.removeAttribute("disabled")
    apkDropdown.onchange = async (event: Event) => {
        console.log(event)
        const selectedValue = (event.target as HTMLSelectElement).value;
        console.log("Selected value:", selectedValue)
        const patchesDiv = document.getElementById('patchoptions');
        const patches = await (await fetch(`/patches/${selectedValue}`)).json()
        // const patches = fetchedpatches.map(e => `${e.name} - ${e.description}`)
        patchesDiv.innerHTML = ""
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
                const target = event.target as HTMLInputElement;
                if (target.checked) {
                    createOptionsUI(p, optionsdiv); // Create options UI when checkbox is checked
                } else {
                    // Clear options UI when checkbox is unchecked
                    optionsdiv.innerHTML = '';
                }
            });

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
    };

    document.getElementById('uploadForm').addEventListener('submit', async function (event) {
        event.preventDefault(); // Prevent form submission

        const formData = new FormData(); // Create FormData object
        const fileInput = document.getElementById('fileInput') as HTMLInputElement; // Get file input element
        const apkDropdown = document.getElementById('apkoptions') as HTMLSelectElement; // Get APK dropdown
        const selectedApp = apkDropdown.value; // Get selected APK name

        const selectedPatches: { name: string; options: { [key: string]: string } }[] = []; // Array to store selected patches and their options

        // Loop through patch checkboxes to get selected patches
        const patchCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of Array.from(patchCheckboxes)) {
            if ((checkbox as HTMLInputElement).checked) {
                const patchName = (checkbox as HTMLInputElement).value;
                const optionsDiv = (checkbox.parentElement as HTMLDivElement).querySelector('div');
                const options: { [key: string]: string } = {};

                // If options are present, gather selected option values
                if (optionsDiv) {
                    const optionInputs = optionsDiv.querySelectorAll('input, select');
                    for (const input of Array.from(optionInputs)) {
                        options[(input as HTMLInputElement).name] = (input as HTMLInputElement).value;
                    }
                }

                selectedPatches.push({ name: patchName, options });
            }
        }

        // Add file and selected options to FormData
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            formData.append('file', file);
        }

        // Append selected app and patches to FormData
        formData.append('app', selectedApp);
        formData.append('patches', JSON.stringify(selectedPatches));

        try {
            // Send AJAX request to upload file and selected options
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                console.log('File and selected options uploaded successfully');
                // Handle response from the server if needed
            } else {
                console.error('Error uploading file and selected options');
            }
        } catch (error) {
            console.error('Error uploading file and selected options:', error);
        }
    });
})




// Interface for patch option
interface PatchOption {
    key: string;
    default: string;
    values?: { [key: string]: string };
    title: string;
    description: string;
    required: boolean;
}

// Interface for patch
interface Patch {
    name: string;
    description: string;
    compatiblePackages: { name: string, versions: string[] | null }[];
    use: boolean;
    requiresIntegrations: boolean;
    options: PatchOption[];
}

// Function to create options UI for a patch
function createOptionsUI(patch: Patch, patchoptionsdiv) {
    // const patchoptionsdiv = document.getElementById('optionsDiv');
    patchoptionsdiv.innerHTML = ''; // Clear previous options

    // Loop through the options of the patch
    for (const option of patch.options) {
        // Create label for the option
        const label = document.createElement('label');
        label.innerText = `${option.title}: ${option.description}`;
        patchoptionsdiv.appendChild(label);
        patchoptionsdiv.appendChild(document.createElement('br')); // Add line break

        // Create input element based on option type
        if (option.values && !option.values.Default) {
            const select = document.createElement('select');
            select.name = option.key;
            select.id = option.key;
            // Populate select with option values
            for (const [key, value] of Object.entries(option.values)) {
                const optionElement = document.createElement('option');
                optionElement.value = value;
                optionElement.text = key;
                select.appendChild(optionElement);
            }
            patchoptionsdiv.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = option.key;
            input.id = option.key;
            patchoptionsdiv.appendChild(input);
        }

        patchoptionsdiv.appendChild(document.createElement('br')); // Add line break
    }
}