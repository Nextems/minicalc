# MiniCalc

An always-on-top desktop calculator widget built with Tauri 2.

## Run it

Prerequisites: Rust (1.77+), Node.js, and the Tauri system dependencies
for your OS — https://tauri.app/start/prerequisites/

    npm install
    npx tauri icon        # generates src-tauri/icons/ (any square PNG works)
    npm run dev

To produce an installer:

    npm run build

## Layout

    src/index.html            interface (dark theme, frameless)
    src/main.js               calculator logic + window controls
    src-tauri/tauri.conf.json window config: alwaysOnTop, 280x400, no decorations
    src-tauri/capabilities/   permissions for drag / close / always-on-top

## Notes

- `npx tauri icon` is required once: the bundle config references
  `src-tauri/icons/`, and the build fails if those files are missing.
- The pin button in the title bar toggles always-on-top at runtime.
- The clock button opens the history panel. History lives in
  sessionStorage: it survives a reload, and is dropped when the app closes.
  Tap an entry to load that result back into the display.
- Keyboard: digits, `+ - * /`, `Enter` or `=`, `.` or `,`, `%`,
  `Backspace`, `Esc` to clear, `H` for history.
