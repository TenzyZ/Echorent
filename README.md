# EchoRent

Same goal. Same cars. A great experience for travellers.

EchoRent is a car rental product. This repository contains the frontend scaffold and a stub API. There is no business logic yet.

**Status: scaffolding only.** The screens show fake example cars. No screen has search, select, or payment logic.

## The flow

The flow has two roles.

**Tenzy** owns the backend and the rental agent. The agent, Ryan, talks to the customer. He asks: "Where would you like to pick up your car?" Then he checks the rental details and finds cars.

**Seng** owns the frontend. The UI shows one card for each car that the agent finds. Each card has a Select button.

Both sides use the same car data. The UI and the stub API read one file: `shared/cars.json`.

The plan:

1. Design with fake example cars now.
2. Connect the real backend later.
3. The UI does not change when the backend changes.

## Requirements

- Node.js 20 or later.

## Quick start

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:5173>.

To view the components in isolation, start Storybook:

```bash
npm run storybook
```

Then open <http://localhost:6006>.

To start the stub API, run:

```bash
npm run server
```

The stub API listens on port 8787.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server on port 5173. |
| `npm run build` | Type-checks the source and builds the app into `dist/`. |
| `npm run preview` | Serves the production build. |
| `npm run storybook` | Starts Storybook on port 6006. |
| `npm run build-storybook` | Builds Storybook into `storybook-static/`. |
| `npm run server` | Starts the stub API on port 8787. |

## Project structure

```
src/
  App.tsx                  The two screens: search and results.
  components/CarCard.tsx   The shared car card with the Select button.
  cars.ts                  The Car type and getCars().
  index.css                Brand tokens and styles.
  *.stories.tsx            Storybook stories.
shared/
  cars.json                The fake cars. One source for the UI and the stub API.
server/
  server.mjs               The stub API. No dependencies.
.storybook/                The Storybook configuration.
```

## The car contract

Both sides of the flow use this shape. The type lives in `src/cars.ts`.

| Field | Type | Example |
| --- | --- | --- |
| `id` | string | `"corolla"` |
| `name` | string | `"Toyota Corolla"` |
| `category` | string | `"Economy"` |
| `transmission` | string | `"Automatic"` |
| `seats` | number | `5` |
| `bags` | number | `2` |
| `pricePerDay` | number | `60` |
| `currency` | string | `"SGD"` |

The UI reads car data only through `getCars()` in `src/cars.ts`. Today, this function returns the fake cars from `shared/cars.json`.

## The stub API

The stub API serves the same fake cars as the UI. It shows the response shape for the real backend.

| Endpoint | Response |
| --- | --- |
| `GET /api/health` | `{"ok":true}` |
| `GET /api/cars` | An array of car objects in the shape of the contract. |

## Connect the real backend later

1. Replace the body of `getCars()` in `src/cars.ts` with a call to `fetch('/api/cars')`.
2. Delete the stub API in `server/`.
3. Do not change any component. This is the point of the contract.
