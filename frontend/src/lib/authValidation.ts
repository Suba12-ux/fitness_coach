export type AuthMode = "login" | "register";

export interface AuthFormState {
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
}

export type AuthFormErrors = Partial<
  Record<"email" | "password" | "confirmPassword", string>
>;

export const EMPTY_AUTH_FORM: AuthFormState = {
  email: "",
  password: "",
  confirmPassword: "",
  rememberMe: false,
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) {
    return "Введите email.";
  }
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return "Введите корректный email.";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return "Введите пароль.";
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Пароль должен содержать не более ${MAX_PASSWORD_LENGTH} символов.`;
  }
  if (!value.trim()) {
    return "Пароль не может состоять только из пробелов.";
  }
  return null;
}

export function validateAuthForm(
  mode: AuthMode,
  form: AuthFormState,
): AuthFormErrors {
  const errors: AuthFormErrors = {};

  const emailError = validateEmail(form.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (mode === "login") {
    if (!form.password) {
      errors.password = "Введите пароль.";
    }
  } else {
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      errors.password = passwordError;
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = "Повторите пароль.";
    } else if (form.confirmPassword !== form.password) {
      errors.confirmPassword = "Пароли не совпадают.";
    }
  }

  return errors;
}

export interface ChangePasswordState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordErrors = Partial<
  Record<keyof ChangePasswordState, string>
>;

export const EMPTY_CHANGE_PASSWORD: ChangePasswordState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function validateChangePasswordForm(
  form: ChangePasswordState,
): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};

  if (!form.currentPassword) {
    errors.currentPassword = "Введите текущий пароль.";
  }

  const newPasswordError = validatePassword(form.newPassword);
  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  } else if (form.newPassword === form.currentPassword) {
    errors.newPassword = "Новый пароль должен отличаться от текущего.";
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = "Повторите новый пароль.";
  } else if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = "Пароли не совпадают.";
  }

  return errors;
}
