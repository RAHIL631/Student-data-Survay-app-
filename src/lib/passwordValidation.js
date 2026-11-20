export function getPasswordValidationError(password, confirmation) {
  if (!password) {
    return 'Enter a new password.';
  }
  if (password.length < 8) {
    return 'Your password must be at least 8 characters.';
  }
  if (!confirmation) {
    return 'Confirm your new password.';
  }
  if (password !== confirmation) {
    return 'The passwords do not match.';
  }
  return null;
}
