// Allow a history of commands to be kept
// The most recent command is at the top (large index)
let history = [];
let historyIndex = -1;
const historyMaxSize = 30;

const code_input = document.getElementById("code");
const output_area = document.getElementById("output-box");

/**
 * Moves the scroll position of the output area to the bottom.
 */
function resetScroll() {
    output_area.scroll(0, output_area.scrollHeight);
}

/**
 * Appends text to the output area formatted as a code block with syntax
 * highlighting.
 * @param {*} code_snippet - a string containing the code snippet to be appended
 */
function appendCode(code_snippet) {
    let code_parent = document.createElement("pre");
    let code_element = document.createElement("code");
    code_element.classList.add("language-python");

    const split_lines = code_snippet.split("\n");
    const num_lines = split_lines.length;
    for (let i = 0; i < num_lines; i++) {
        let colored_span = document.createElement("span");
        colored_span.classList.add("output-header");
        const header_content = (i === 0) ? ">>> " : "... ";
        let header_arrows = document.createTextNode(header_content);
        colored_span.appendChild(header_arrows);
        code_element.appendChild(colored_span);

        let code_text = document.createTextNode(split_lines[i] + "\n");
        code_element.appendChild(code_text);
    }

    code_parent.appendChild(code_element);
    output_area.appendChild(code_parent);

    // Trigger syntax highlighting
    if (window.hljs) {
        hljs.highlightElement(code_element);
    }
    resetScroll();
}
/**
 * Appends output to the output area as standard text.
 * @param {*} output_str - a string containing the output to be appended
 */
function appendOutput(output_str) {
    let newElement = document.createElement("p");
    newElement.classList.add("output-text");
    let text_contents = document.createTextNode(output_str);
    newElement.appendChild(text_contents);
    output_area.appendChild(newElement);
    resetScroll();
}

/** * Appends an error message to the output area, formatted in red.
 * @param {*} err_str - a string containing the error message to be appended
 */
function appendError(err_str) {
    let newElement = document.createElement("p");
    newElement.classList.add("output-error");
    let text_contents = document.createTextNode(err_str);
    newElement.appendChild(text_contents);
    output_area.appendChild(newElement);
    resetScroll();
}

/**
 * Initializes the Pyodide environment and installs the necessary packages.
 * @returns Promise that resolves to the Pyodide instance.
 */
async function setup_environment() {
    appendOutput("Initializing...");
    let pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("https://pynapple-org.github.io/pynapple-learn/_static/pynapple-0.8.5-py3-none-any.whl");

    pyodide.runPython("import numpy as np; import pynapple as nap;")

    // Redirect standard output to our rich formatter:
    // TODO: see how this works with partial flushed output
    pyodide.setStdout({
        batched: (str) => {
            appendOutput(str);
        },
    });
    // Not really necessary to pipe stderr since pyodide converts them to JS errors
    appendOutput("Ready!");
    return pyodide;
}
let pyodideReadyPromise = setup_environment();

/**
 * Grabs a python code snippet from the input box, evaluates it, and reports its output.
 * @returns Nothing
 */
async function evaluatePython() {
    let pyodide = await pyodideReadyPromise;
    try {
        let code = code_input.value.trim();
        if (code === "") {
            return;
        }
        code_input.value = "";

        history.push(code);
        historyIndex = -1; // Reset history index after adding a new command
        if (history.length > historyMaxSize) {
            history.shift(); // Remove the oldest command if we exceed the max size
        }


        appendCode(code);
        let out = pyodide.runPython(code);
        // If the output is None (default return value for python functions with no explicit return), don't append "Undefined"
        if (out !== undefined) {
            appendOutput(out);
        }
    } catch (err) {
        appendError(err);
    }
}

/**
 * Overrides the default tab behavior to allow users to insert tabs in their
 * multi-line code input.
 */
code_input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent the browser from changing focus
        // Insert four spaces
        const start = code_input.selectionStart;
        const end = code_input.selectionEnd;
        code_input.value =
            code_input.value.substring(0, start) +
            "    " + // Four spaces for indentation
            code_input.value.substring(end);
        // Move the cursor to the end of the inserted spaces
        code_input.selectionStart = start + 4;
        code_input.selectionEnd = start + 4;
    }
});

/**
 * Handles other key events related to code input: code sumbission and history navigation.
 *   - Shift + enter: evaluates the code in the input box
 *   - Up arrow: navigates to the previous command in history
 *   - Down arrow: navigates to the next command in history
 */
code_input.addEventListener("keyup", (event) => {
    // Reset the history index if a non-arrow key is pressed
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        historyIndex = -1;
    }

    if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        evaluatePython();
        return;
    }

    // If the input is multi-line, the user probably intends to use the up/down arrows to navigate the text,
    // rather than the history:
    if (code_input.value.includes("\n")) {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            // Skips the following history nav code
            return;
        }
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        if (history.length == 0) {
            return;
        } else if (historyIndex === -1 && direction === -1) {
            historyIndex = history.length - 1;
            code_input.value = history[historyIndex];
        } else if (historyIndex === -1 && direction === 1) {
            // do nothing in this case, but don't allow the next clause to trigger
        } else if (
            historyIndex + direction >= 0 &&
            historyIndex + direction < history.length
        ) {
            historyIndex += direction;
            code_input.value = history[historyIndex];
        } else if (historyIndex === history.length - 1 && direction === 1) {
            historyIndex = -1;
            code_input.value = "";
        } 
    }
});