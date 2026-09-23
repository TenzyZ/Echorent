import { handleSearchCars } from "../../backend/http.mjs";

export async function onRequest({ request }) {
  return handleSearchCars(request);
}
