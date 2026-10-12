/**
 * Machine-readable add-child / onboarding error codes → plain English.
 * Single source of truth shared by the onboarding wizard (step-children)
 * and the standalone /add-child page.
 */
export function childErrorMessage(code: string): string {
  switch (code) {
    case "not_signed_in":
      return "You're not signed in anymore. Please sign in again.";
    case "attestation_required":
      return "Please check the box confirming you're this child's parent or legal guardian.";
    case "already_has_family":
      return "You already have a family set up — add more children from Settings → Profile.";
    case "guardian_only":
      return "Only a parent or legal guardian can add a child. Pookie accounts are for ages 13 and up.";
    case "name_required":
      return "Please enter your child's name.";
    case "name_too_long":
      return "That name is too long — please shorten it.";
    case "birthdate_invalid":
      return "Please enter a valid birthdate.";
    case "birthdate_in_future":
      return "The birthdate can't be in the future.";
    case "birthdate_implausible":
      return "That birthdate doesn't look right — please check it.";
    case "invalid_email":
      return "That email address doesn't look right.";
    case "profiles_not_ready":
      return "Pookie is still setting up your profile. Please wait a moment and try again.";
    default:
      return "Couldn't save that. Please try again.";
  }
}
