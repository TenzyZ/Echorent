import { handleVoiceToken } from "../../../backend/http.mjs";

export async function onRequest({ request, env }) {
  return handleVoiceToken(request, {
    apiKey: env.ASSEMBLYAI_API_KEY,
    agentId: env.AGENT_ID_ECHORENT,
  });
}
