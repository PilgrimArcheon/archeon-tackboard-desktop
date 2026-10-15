# TackBoard Desktop — unsigned preview installers

These automated files are **preview builds for internal / test-device validation only**, not publicly approved customer installers.

- Windows: `TackBoard Setup <version>.exe` (x64), run on Windows 10/11. Unsigned packages may trigger SmartScreen.
- Mac: distinct `.dmg` packages for Apple Silicon (`arm64`) and Intel (`x64`). Unsigned/unnotarized DMGs may be blocked by Gatekeeper.
- Matching Mac `.zip` packages are provided for diagnostics, not as the default installation method.
- `SHA256SUMS.txt` contains SHA-256 hashes to verify the downloaded files.

**Before public release**: Test install/uninstall, tray/menu bar, floating sticky notes, light/dark mode, login/pairing, two-way sync, reboot/update and backup recovery on real devices. Sign Windows installers and sign/notarize macOS packages using appropriate certificates and GitHub Actions secrets. Only then link finalized release assets on the Archeon website.

**Data safety**: Back up existing TackBoard notes before installing. Pairing a desktop to an Archeon account downloads cloud boards and **replaces** the current local board set after confirmation, with a recovery backup.
