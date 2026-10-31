---
title: TypeR 2.0
date: 2025-06-08
version: 2.0.0
summary: Strokes in styles, auto-centering without a selection, update checks, a new import and export, and persistent PSDs.
---

## New features

- Added **stroke (outline)** support to styles.
- **Auto-centering** now works without a manual selection by automatically detecting the bubble shape (like in Typesetterer).
- **Automatic update check** on startup.
- Ability to **duplicate a style**.
- Option to **change the interface language** in the settings.
- New **Auto Close PSD** setting: automatically closes the previously opened PSD when switching pages, if it was imported through TypeR.
- Redesigned the file explorer interface for **Open PSD Directory**.
- **Import and export** have been redone: a single interface in the settings lets you choose which folders to import or export.
- Imported PSDs now **persist** after restarting Photoshop, with an option to unsync them if needed.
- Use the tag `//` to give a line the same tag style as the previous one.
- The end-of-page block is turned off when no PSDs have been imported into TypeR.

## Fixes

- Fixed several translation issues.
- No more error when inserting text with an undefined size in the selected style.
- Styles with the same prefix are now prioritized based on the currently selected folder.
