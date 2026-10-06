# Ferroprint

Ferroprint is a blueprint-style sketchpad for system diagrams, flows, interface wireframes and floor plans. It runs in the browser and saves your work in the browser's `localStorage`. No account and no server are necessary.

Open the app: https://bjarneo.github.io/ferroprint/

## What you can do

- Draw boxes, services, databases, queues, actors, zones, decisions, windows, buttons, inputs, images, rooms, doors, notes and text.
- Connect shapes with elbow, straight or curved connectors.
- Draw freehand strokes and walls. Hold Shift to snap a wall to 45°.
- Organize a project in numbered sheets, each with its own title block and drawing units (px, ft or m).
- Switch between a blueprint (white on blue) and a whiteprint (blue on white) look.
- Export a sheet as PNG or SVG with a title block. Export the full project as JSON.

Press `?` in the app to see all keyboard shortcuts.

## How saving works

- Every change saves to `localStorage` in this browser after a short delay. The top bar shows `SAVED`, `SAVING` or `NOT SAVED`.
- Press `Ctrl S` (`⌘S` on macOS) to save at once.
- If the app is open in two tabs, each tab takes the changes that the other tab saves.
- `localStorage` belongs to one browser on one device. To move a project or keep a backup, use **Export JSON**, then **Open** the file on the other device.
- If the browser blocks storage or the storage is full, the top bar shows `NOT SAVED`. Export JSON to keep your work.
- **New** and **Open** replace the current project. The message that follows has an **UNDO** button that brings the previous project back.

## Run it locally

You need Node.js 20.19, or 22.12 or later.

```sh
npm install
npm run dev
```

To make a production build in `dist/`, run:

```sh
npm run build
npm run preview
```

## Deploy

The workflow in `.github/workflows/pages.yml` builds the app and publishes `dist/` to GitHub Pages on every push to `main`. The build uses relative asset paths, so it works from any repository name.

## Project layout

| File | Purpose |
| --- | --- |
| `src/engine.js` | Shapes, themes, geometry, units, document validation and export helpers |
| `src/draw.jsx` | SVG drawing for shapes, connectors and dimension marks |
| `src/Editor.jsx` | Editor state, pointer and keyboard input, history, sheets, files and autosave |
| `src/chrome.jsx` | Toolbars, inspector, panels, title block and status bar |
| `src/storage.js` | Safe access to `localStorage` |
