/**
 * OAuth iframe communication handler
 * Manages OAuth callback communication between parent window and iframe
 */

export interface OAuthMessage {
  type: "oauth-success" | "oauth-error" | "oauth-init";
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Listen for OAuth messages from parent window
 * Used when app is embedded in an iframe
 */
export function listenForOAuthMessages(callback: (message: OAuthMessage) => void) {
  window.addEventListener("message", (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) {
      return;
    }

    const message = event.data as OAuthMessage;
    if (message.type === "oauth-success" || message.type === "oauth-error") {
      callback(message);
    }
  });
}

/**
 * Send OAuth message to parent window
 * Used when app needs to communicate with parent iframe
 */
export function sendOAuthMessageToParent(message: OAuthMessage) {
  if (window.self !== window.top) {
    // We're in an iframe, send message to parent
    window.parent.postMessage(message, "*");
  }
}

/**
 * Check if app is running in an iframe
 */
export function isInIframe(): boolean {
  return window.self !== window.top;
}

/**
 * Get the actual backend origin for OAuth callback
 * In iframe, this should be the Manus backend, not the iframe origin
 */
export function getOAuthBackendOrigin(): string {
  // Use the custom domain if available, otherwise fall back to Manus
  const origin = window.location.origin;
  if (origin.includes("ai.holistischadviseur.nl")) {
    return origin; // Use custom domain
  }
  return "https://holisticaiclinic-bcqmgen2.manus.space"; // Fall back to Manus
}

/**
 * Get the return origin (where to redirect after OAuth)
 * In iframe, this should be the iframe origin
 */
export function getOAuthReturnOrigin(): string {
  return window.location.origin;
}
