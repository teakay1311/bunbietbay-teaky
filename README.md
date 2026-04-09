<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy this app

This repo is a Vite + React app and can be deployed as a static site.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow for GitHub Pages deployment.

1. Push the repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to the `main` or `master` branch.

The workflow will:
- install dependencies with `npm ci`
- build the app with the correct GitHub Pages base path
- use `HashRouter` only for the GitHub Pages build, so refreshing sub-pages works

If your default branch is not `main` or `master`, update the workflow branch trigger.
