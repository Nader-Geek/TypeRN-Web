---
title: TypeR 2.2
date: 2025-08-15
version: 2.2.5
summary: Multi-bubble mode arrives in beta, along with saved states, a redesigned settings page and new customization options.
---

## New features

- **Multi-bubble mode (beta).** Capture and insert text into multiple bubbles in a single operation. Enable it in the settings. It is functional but still under testing, so feedback is welcome.
- **Save current state.** Save the current state of TypeR (text, imported PSDs, selected line) to typeset several series without losing your progress (in the settings).
- **Style saved per selection.** You can switch to any style during the multi-bubble capture and it will insert it.
- **Custom text size increment.** A numeric field sets the increment used by the text size buttons.
- **Optional auto-resize on centering.** A setting controls whether the text box resizes to match the selection when using the Center Align button.
- **Select all in style export.** A Select All / Deselect All button in the style export window.
- **Disable folder priority.** An option to turn off folder-based priority when searching for styles.
- **Disable a style.** Click the eye icon to temporarily stop a style from matching its prefix.

## Improvements

- Redesigned settings page with more customization and clearer sections for options, shortcuts and TypeR behavior.
- Removed automatic shrinking of text boxes: TypeR now uses the exact Photoshop selection dimensions.

## 2.2.1, 2.2.2 and 2.2.3

- Multi-bubble mode now respects page boundaries when PSDs are imported, and there is a new shortcut for the next page.
- Multi-bubble mode now advances to the next line after inserting text.
- Keyboard shortcuts now work properly.

## 2.2.4

- Fixed text being inserted too close to the edges of the bubbles.
- The internal space that keeps text from touching bubble edges is now customizable in the Behavior tab.
- The "-" button that removes a selection in multi-bubble now removes one selection at a time instead of all at once.
- Increasing and decreasing the text size is faster.

## 2.2.5

- Fixed a bug where the text bounding box was way too large.
