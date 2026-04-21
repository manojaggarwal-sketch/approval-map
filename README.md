# Salesforce Advanced Approvals Map

Self-hosted port of the claude.ai artifact. Single-page React app that visualizes
SBAA approval rules, conditions, variables, chains, and approvers.

## What changed vs. the original artifact

- **New "Field Lookup" tab.** Type a Salesforce field API name (e.g.
  `SBQQ__NetTotal__c`) and get every approval rule that touches it — directly
  (as a condition's tested field) or indirectly (through an approval variable
  whose aggregate or filter field matches).
- **Production / Sandbox environments.** A segmented toggle sits on the right
  of the tab bar. Each env has its own baked snapshot
  (`public/data.production.json` and `public/data.sandbox.json`) and its own
  localStorage preview slot. Admin uploads are scoped to whichever env is
  currently selected. The app always opens on Production.
- **Shared-storage model.** The original used claude.ai's `window.storage`
  shared tier. Self-hosted, the app loads the active env's baked JSON on
  startup (everyone sees the same data), and admin uploads are staged in
  `localStorage` + exported as a downloadable JSON the admin commits to the
  repo. See *Updating a shared snapshot* below.

## Running locally

```bash
npm install
npm run dev
```

## Deploying to GitHub Pages

1. Create a new GitHub repository (private is fine — GitHub Pages works on
   private repos on paid plans, public is the default free path).
2. Push this project to it.
3. In the repo settings → *Pages*, set *Source* to **GitHub Actions**.
4. The included workflow at `.github/workflows/deploy.yml` will build and
   deploy on every push to `main`. The resulting URL will be
   `https://<user-or-org>.github.io/<repo-name>/`.
5. Share that URL with your team. It is stable forever — any future update is
   just another commit to `main`.

### Why not the claude.ai URL?

The original `https://claude.ai/artifacts/latest/...` URL is tied to the
conversation that created it and cannot be retargeted externally. Because the
original conversation is full and can't accept edits, the only way to keep a
stable, updatable URL is self-hosting — the GitHub Pages URL you pick above is
the permanent home going forward.

## Updating a shared snapshot

Each environment has its own shared snapshot:

- Production: `public/data.production.json`
- Sandbox: `public/data.sandbox.json`

On load, the app fetches whichever file matches the active env. If that file is
missing, it falls back to the base64-embedded fallback compiled into the bundle
(same fallback for both envs — upload real data to differentiate them).

To publish new data:

1. Open the deployed site.
2. Flip the **tab-bar toggle** to the env you want to edit (Production or
   Sandbox).
3. Go to the **Admin** tab, upload the refreshed CSVs from your SOQL exports,
   and click *Save*. This:
   - previews the data locally for you (localStorage, scoped to that env),
   - downloads a file named `data.production.json` or `data.sandbox.json`
     (matching the current env).
4. Drop the file into `public/` in the repo (easiest: GitHub's web "Edit this
   file" button, or `git add public/data.<env>.json && git commit && git push`).
5. The GitHub Action redeploys in ~1 minute and every viewer sees the new data
   for that env on next page load.

To wipe a snapshot and fall back to the embedded data, delete the corresponding
`public/data.<env>.json` and push.

## Project layout

```
approval-map-standalone/
├── .github/workflows/deploy.yml   # GH Pages CI
├── index.html                     # Vite entry
├── package.json
├── vite.config.js                 # `base` driven by VITE_BASE env var
├── public/
│   ├── data.production.json       # (optional) Production snapshot; commit to update
│   └── data.sandbox.json          # (optional) Sandbox snapshot; commit to update
├── src/
│   ├── main.jsx                   # React entry; installs storage adapter first
│   ├── storage.js                 # window.storage shim (fetch data.<env>.json + localStorage)
│   └── App.jsx                    # The ported component (~1800 lines)
└── README.md
```

## Notes on dependencies

Only three runtime deps are needed: `react`, `react-dom`, `papaparse`,
`lodash`. No Tailwind, no shadcn — the component uses inline styles throughout.
The bundle is ~500 KB (240 KB gzipped) and everything runs on the client.
