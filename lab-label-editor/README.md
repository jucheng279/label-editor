# Lab Label Studio

A modern TypeScript + React box-label editor for laboratory inventory systems.

## Features

- Smart configurable N × N box grid
- Editable sample name, information, date, and status per position
- Automatic detailed / compact / micro responsive label variants
- Physical label dimensions in millimetres
- Header, footer, QR preview, coordinates, grid lines, and empty-cell controls
- Top/bottom viewing direction, rotation, and mirroring controls
- Live overflow and print validation
- Undo / redo keyboard shortcuts
- Local template persistence
- JSON template import and export
- Print-ready browser layout with physical dimensions

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Integration notes

Replace the sample `slots` data in `initialState` with data loaded from your inventory API or Supabase. The template state is intentionally JSON-serializable so it can be stored in a `label_template_versions.template_schema` JSONB column.
