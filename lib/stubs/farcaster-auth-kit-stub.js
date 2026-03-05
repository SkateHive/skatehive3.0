// Stub for @farcaster/auth-kit to prevent SSR indexedDB errors
// This file is used only on the server-side via webpack alias

export const AuthKitProvider = ({ children }) => children;
export const SignInButton = () => null;
export const useProfile = () => ({ 
  isAuthenticated: false, 
  profile: null 
});
export const useSignIn = () => ({
  signIn: () => {},
  signOut: () => {},
  isSuccess: false,
  isError: false,
  error: null,
  channelToken: null,
  url: null,
  data: null,
  validSignature: false,
  connect: () => {},
  reconnect: () => {}
});
