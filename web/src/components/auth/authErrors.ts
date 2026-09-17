/** Maps Firebase Auth error codes to friendly, actionable messages. */
export function friendlyAuthError(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right. Please check it and try again.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password. Please try again or reset your password.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in window was closed before finishing. Please try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled for this project. Enable it in the Firebase console.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised for sign-in. Add it under Firebase Authentication > Settings.";
    case "auth/requires-recent-login":
      return "For security, please log out and log in again before changing this.";
    default:
      if (err instanceof Error && err.message) return err.message;
      return "Something went wrong. Please try again.";
  }
}
