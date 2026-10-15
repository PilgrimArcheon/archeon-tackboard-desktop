# TackBoard Desktop v0.6.0 — build and publish for Windows + macOS

## What this source bundle contains

This is the **standalone desktop application**, not your Next.js/Neon project. The bundle contains complete Electron source, icon assets, reproducible `package-lock.json`, 34 tests and a GitHub Actions workflow for native Windows + Mac installers. The uploaded `tackboard-backup-2026-10-14.json` was deliberately **excluded**; do not commit personal note backups.

**No installer binaries have been compiled, signed or published from this environment.** Use the native operating-system runners through GitHub Actions. The pipeline creates *unsigned preview* binaries for testing. Do not advertise them as production-ready until signing/notarization and installation tests pass.

## 1 — Create a separate repository

Make a private GitHub repository, e.g. `archeon-tackboard-desktop` (choose your own name). Extract the ZIP into an empty local directory. The extracted folder should contain `package.json`, `.github/workflows/tackboard-desktop-installers.yml`, `src`, `assets`, `tests`, and `scripts` directly at its root. Do not nest it under the Next.js repo.

Run in PowerShell **inside that extracted desktop folder**:

```powershell
npm ci
npm run verify:release
npm test

git init
git branch -M main
git add .
git status --short
# Check no private note backups, .env files, node_modules or dist are staged.
git commit -m "Prepare TackBoard v0.6.0 native installers"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_NEW_DESKTOP_REPO.git
git push -u origin main
```

Replace the `YOUR_*` placeholders. If the repo already has a Git remote, use its actual URL instead of running `git init` or `git remote add origin` again.

## 2 — Produce preview installer artifacts

Open the new GitHub repository → **Actions** → **TackBoard Desktop installers** → **Run workflow** → branch `main` → **Run workflow**.

The workflow uses `windows-latest` to build an NSIS Windows `.exe`, and `macos-latest` to build both Intel (x64) and Apple Silicon (arm64) `.dmg` plus `.zip`. It runs all tests before producing downloadable Actions artifacts. **Do not link these CI preview artifacts from the public Archeon site.**

If a job fails, view its Actions logs. Typical causes include dependency registry failures, macOS code-signing settings, or Electron Builder environment issues.

## 3 — Publish the preview as a GitHub prerelease (after testing)

From the desktop repository root, after the normal Actions run passes, tag the code:

```powershell
git tag tackboard-desktop-v0.6.0
git push origin tackboard-desktop-v0.6.0
```

The tag starts the same workflow, builds native binaries, checks their presence, creates `SHA256SUMS.txt`, and creates a **GitHub prerelease** with the Windows `.exe` and two Mac `.dmg` files. It does not sign or notarize them. On macOS, unsigned DMGs may be blocked by Gatekeeper; on Windows, unsigned EXEs may trigger SmartScreen. Keep that release clearly marked as a preview for approved testers only.

If releases are disabled or organization policies restrict Actions publishing, adjust permissions on that repository; the workflow's publishing job requires GitHub Actions write access to repository contents. Run from the Actions page rather than creating placeholder files.

## 4 — Validate native installers before sharing widely

On a real Windows 10/11 PC: download the EXE, confirm its SHA256, install, open the hub, pin/edit a note, set startup/tray behavior, pair an Archeon account, sync, quit/restart, uninstall, and verify notes aren't deleted unexpectedly.

On *both* an Intel Mac and an Apple Silicon Mac: verify the correct architecture DMG, SHA256, Applications drag-and-drop, menu bar behavior, floating windows and cloud pairing/sync. Back up notes first. Signing and Apple notarization are recommended before distributing to customers; otherwise Gatekeeper warnings may occur.

**Before public distribution**, configure Windows Authenticode signing and Apple Developer ID signing + notarization. Do not claim this unsigned workflow provides those assurances. Keep any signing certificates, passwords, App Store Connect keys, and tokens in repository secrets—never in the source tree.

## 5 — Activate Archeon website download buttons

The existing Next.js page `/app/tackboard/desktop` already supports three HTTPS installer URLs. Once files have been built and reviewed, copy the *actual asset URL* from the GitHub release into these Vercel Project → Settings → Environment Variables, then redeploy:

```dotenv
NEXT_PUBLIC_TACKBOARD_WINDOWS_DOWNLOAD_URL=https://github.com/YOUR_USERNAME/YOUR_NEW_DESKTOP_REPO/releases/download/tackboard-desktop-v0.6.0/EXACT_WINDOWS_FILENAME.exe
NEXT_PUBLIC_TACKBOARD_MAC_ARM64_DOWNLOAD_URL=https://github.com/YOUR_USERNAME/YOUR_NEW_DESKTOP_REPO/releases/download/tackboard-desktop-v0.6.0/EXACT_ARM64_FILENAME.dmg
NEXT_PUBLIC_TACKBOARD_MAC_INTEL_DOWNLOAD_URL=https://github.com/YOUR_USERNAME/YOUR_NEW_DESKTOP_REPO/releases/download/tackboard-desktop-v0.6.0/EXACT_X64_FILENAME.dmg
```

Those are **templates**, not tested/live links. Copy URLs from GitHub's Assets section so spaces and file names are encoded correctly. For a **private** desktop repository, these release assets are not publicly downloadable by your customers. Keep releases private for beta testing, or move verified public release assets to a public distribution repository or other HTTPS file host when ready for customers.

The source hard-codes its cloud API endpoint to `https://archeon-dxvt.vercel.app`, so check that the production TackBoard APIs and pairing work there before distributing. If that URL ever changes, update the desktop source and test again before building new installers.
