# React + Vite

## Weather Intelligence and Flood Impact

This repository is the **parent portal** for Mangrove Weather Intelligence:

- Parent UI: https://saratchai1.github.io/mangrove-weather-intelligence/
- Parent source: https://github.com/saratchai1/mangrove-weather-intelligence
- Flood Impact child UI: https://plot-flood-impact.saratchai.workers.dev/
- Flood Impact child source: https://github.com/saratchai1/Plot-Flood-Impact

The Environmental Intelligence screen links to the Rayong flood-impact comparison workspace as a child module. It opens the existing Cloudflare Worker in a new tab, so cross-origin iframe permissions, cookies, and API routing are not assumed. The two applications build and deploy independently; this repository does **not** own or duplicate the Flood Impact backend or satellite data.

**Child repository note (2026-10-16):** `Plot-Flood-Impact/main` contains only a README. App and Worker code currently live on feature branches including `feat/rayong-flood-impact`, `v2/uploaded-flood-imagery`, and `feat/local-satellite-cache`. Before changing that child deployment, reconcile its source branch with the live Worker and review it separately.


This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
