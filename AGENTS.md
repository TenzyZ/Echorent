# AGENTS.md

Rules for coding agents that work in this repository.

## Purpose

EchoRent is a car rental product. Tenzy owns the backend and the rental agent. Seng owns the frontend. Both sides use the same car contract. This repository is the frontend scaffold with a stub API.

## Ground rules

- This project is a scaffold. Do not add business logic to the screens.
- Read car data only through `getCars()` in `src/cars.ts`. Do not import the JSON from a component.
- Keep the fake cars in `shared/cars.json`. Do not copy the car data into a second file.
- Do not change the `Car` type without agreement from both sides of the flow.
- Write a Storybook story for each visible component.
- Use plain CSS with the tokens in `src/index.css`. Do not add a CSS framework.
- Do not add a dependency when an installed dependency or a platform feature is sufficient.
- Keep the code minimal. The shortest working solution is correct here.
- Do not delete the stub API. It shows the response shape for the real backend.

## Commands

- `npm run dev` — start the Vite dev server on port 5173.
- `npm run storybook` — start Storybook on port 6006.
- `npm run build` — type-check the source and build the app.
- `npm run build-storybook` — build Storybook into `storybook-static/`.
- `npm run server` — start the stub API on port 8787.

Before you finish a task, run `npm run build` and `npm run build-storybook`. Both commands must pass.

## Documentation style

- Write documentation in Simplified Technical English.
- Keep each sentence short. One instruction per sentence.
- Use the same name for the same thing in the whole document.

## Skills for this repository

- `ponytail` governs code decisions: minimal, no unrequested abstractions, fewest files.
- `simple-english` governs documentation: short sentences, one name per concept, active voice.
- `impeccable` governs UI design: use its critique, audit, and polish passes on the screens and components.
