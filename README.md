# seminar-checkin

This is a [Next.js](https://nextjs.org) project bootstrapped with [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

`ash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying pp/page.tsx. The page auto-updates as you edit the file.

This project uses [
ext/font](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load custom fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Vercel troubleshooting

- If Vercel reports "No Next.js version detected", check the **Root Directory** setting in your Vercel project  it must point to the folder that contains package.json (for this repo it should be the repository root).
- There's a ercel.json at the repo root that can help Vercel detect/build the app. If your project is in a subfolder, either update the Root Directory in Vercel, or move this ercel.json into that folder.
- If the build still fails, open the Vercel build logs and confirm the repository and branch being cloned match this project.

## Docker / Local container run

You can build and run this app in Docker (helpful for VPS or local testing).

Build the image locally:

`powershell
docker build -t seminar-checkin:latest .
`

Run with Docker:

`powershell
docker run --rm -p 3000:3000 -e NODE_ENV=production seminar-checkin:latest
`

Or use docker-compose:

`powershell
docker-compose up --build
`

Notes:
- The Docker image installs libraries required to run Chromium (used by puppeteer). If your environment needs different libs, adjust the Dockerfile.
- The included GitHub Actions workflow (.github/workflows/ci-deploy.yml) will build the app and, if you set the GHCR_PAT secret, push a Docker image to GitHub Container Registry (ghcr.io).
