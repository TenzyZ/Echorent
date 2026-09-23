import { createD1Store } from "../../backend/d1-store.mjs";
import { handleReservationRequest } from "../../backend/http.mjs";
import { createReservationCore } from "../../backend/reservation-core.mjs";

export async function onRequest({ request, env }) {
  const { createBookingRequest } = createReservationCore({
    store: env.DB ? createD1Store(env.DB) : null,
    apiKey: env.RESEND_API_KEY,
    from: env.ECHORENT_EMAIL_FROM,
    notifyTo: env.ECHORENT_NOTIFY_TO,
  });
  return handleReservationRequest(request, { createBookingRequest });
}
