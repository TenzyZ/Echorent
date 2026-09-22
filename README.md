# EchoRent

Voice-first airport car-rental agent for DXB and SIN, powered by AssemblyAI, with conversational vehicle search and human-approved reservation requests.

Built by Tenzy and Seng for the AssemblyAI Voice Agent Hackathon.

## Run locally

Set these server environment variables without exposing their values to the browser:

- `ASSEMBLYAI_API_KEY`
- `AGENT_ID_ECHORENT`
- `ECHORENT_TOOL_SECRET`

```powershell
npm ci
npm run server
npm run dev
```

Use Chrome or Edge for this MVP browser demo.

Run verification with:

```powershell
npm run test:backend
npm test
npm run build
npm run build-storybook
```
