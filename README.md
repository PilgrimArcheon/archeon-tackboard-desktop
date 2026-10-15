# TackBoard Desktop — standalone repo (v0.6.0)

This is the desktop companion source **independent of Archeon Next.js**. It talks directly to the hosted `https://archeon-dxvt.vercel.app` TackBoard API. It is not necessary to copy the web app, Neon secrets, or `node_modules` into this repo.

## Running

Node.js 22+ and npm required. Run `npm install`, `npm test`, `npm start`. On macOS you can also use `bash RUN-TACKBOARD-MAC.command`; on Windows double-click `RUN-TACKBOARD-WINDOWS.cmd`.

**Appearance**: In Settings choose Follow system / Light mint glass / Dark lagoon glass. Floating notes retain their paper colors regardless. On Windows and macOS, exact desktop-behind-window blur depends on the OS compositor. Reduced-transparency system settings disable blur for readability.

**Account data**: Saved in Electron's per-user application data directory, **not** in this source tree. Keep the appId/productName unchanged during migration to retain installed-app storage. Back up your notes before upgrading and verify pairing with a test board.

## Packaging

Windows (on Windows): `npm run dist:win`. Mac (on macOS): `npm run dist:mac`. The workflow in `.github/workflows/tackboard-desktop-installers.yml` builds unsigned previews on the appropriate OS runners. Sign Windows binaries and sign/notarize macOS releases before distributing to users; installable files are not included in this ZIP.

## Repositories

Create a **separate private GitHub repo**, e.g. `archeon-tackboard-desktop`, and push this folder as the repository root. Keep `archeon-nextjs` separate. Publishing installers requires copying reviewed release download URLs into the existing Next.js deployment environment variables.


## Account setup (v0.6)

Use Settings → Account & cloud → Export local backup **before** pairing if you want to retain local notes.
Choose **Connect account**, enter a valid pairing key from `https://archeon-dxvt.vercel.app/app/tackboard`, and confirm replacement. Pairing always downloads the cloud boards, replacing local boards and queued edits. An additional private recovery snapshot is made automatically. This operation never pushes a stale local snapshot into the cloud.

On the main screen, open **Active board** and select **+ Create new board** or **Rename current board**. Both are saved locally immediately and queued for the Neon-backed cloud. The app polls for remote changes and exposes **Sync now** in Settings.

Desktop installers are not signed or notarized by default; GitHub Actions produces preview builds for native testing. Do not distribute these as customer-ready binaries until signing and compatibility testing are complete.

## Building preview installers with GitHub Actions

See [`DESKTOP-RELEASE-STEPS.md`](DESKTOP-RELEASE-STEPS.md). This ZIP is source only; the GitHub workflow builds Windows and macOS native installers. Preview binaries are unsigned and are not a finished customer release.
