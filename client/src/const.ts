export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate the Manus OAuth login URL.
 *
 * KEY INSIGHT: The session cookie must be set on the SAME domain the user is
 * browsing from. If the user is on ai.holistischadviseur.nl, the callback must
 * also go through ai.holistischadviseur.nl/api/oauth/callback so the cookie
 * is set on that domain.
 *
 * We use window.location.origin as the redirectUri base so the callback always
 * matches the current domain. The state only needs to carry the returnTo path
 * (the full returnTo is the origin itself after login).
 */
export const getLoginUrl = (returnPath?: string): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // Use the current origin so the OAuth callback sets the cookie on the right domain
  const currentOrigin = window.location.origin;
  const redirectUri = `${currentOrigin}/api/oauth/callback`;

  // The returnTo is where the user ends up after successful login.
  const returnTo = returnPath
    ? `${currentOrigin}${returnPath}`
    : currentOrigin;

  // Encode both redirectUri and returnTo in the state
  const statePayload = JSON.stringify({ redirectUri, returnTo });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
