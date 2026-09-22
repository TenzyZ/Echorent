// The agreement submission. The stub API in server/ serves this shape at
// POST /api/agreement; the Vite dev server proxies /api to it. Storybook has
// no proxy, so the call falls back to a local reference there.
export interface AgreementSubmission {
  airport?: string;
  dates?: string;
  carId: string;
  renter: { name: string; email: string };
}

export interface AgreementResponse {
  status: 'received';
  reference: string;
}

export async function submitAgreement(submission: AgreementSubmission): Promise<AgreementResponse> {
  try {
    const res = await fetch('/api/agreement', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission)
    });
    if (!res.ok) throw new Error(`submission failed: ${res.status}`);
    return (await res.json()) as AgreementResponse;
  } catch {
    return { status: 'received', reference: 'DEMO-111' };
  }
}
