export interface PasswordCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function checkPassword(password: string): PasswordCheck {
  return {
    minLength: password.length >= 6,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordStrong(password: string): boolean {
  const checks = checkPassword(password);
  return checks.minLength && checks.hasUppercase && checks.hasNumber && checks.hasSpecial;
}
