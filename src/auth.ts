// Stub Google sign-in for the demo. The backend has no auth endpoint yet,
// so the handler only returns a fake user after a short pause.
export interface User {
  name: string;
  email: string;
}

export const demoUser: User = { name: 'Amirah Tan', email: 'amirah.tan@gmail.com' };

export function signInWithGoogle(): Promise<User> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(demoUser), 300);
  });
}
