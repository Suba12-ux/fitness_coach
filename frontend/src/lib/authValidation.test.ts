import { describe, expect, it } from "vitest";

import {
  EMPTY_AUTH_FORM,
  EMPTY_CHANGE_PASSWORD,
  validateAuthForm,
  validateChangePasswordForm,
  validateEmail,
  validatePassword,
} from "./authValidation";

describe("validateEmail", () => {
  it("rejects empty and malformed emails", () => {
    expect(validateEmail("")).toBeTruthy();
    expect(validateEmail("not-an-email")).toBeTruthy();
    expect(validateEmail("user@localhost")).toBeTruthy();
  });

  it("accepts a valid email regardless of case and spaces", () => {
    expect(validateEmail("  User@Example.COM ")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("enforces the backend password policy", () => {
    expect(validatePassword("")).toBeTruthy();
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("        ")).toBeTruthy();
    expect(validatePassword("password123")).toBeNull();
  });
});

describe("validateAuthForm", () => {
  it("requires only a password for login", () => {
    const errors = validateAuthForm("login", {
      ...EMPTY_AUTH_FORM,
      email: "user@example.com",
      password: "x",
    });

    expect(errors).toEqual({});
  });

  it("requires a strong matching password for registration", () => {
    const errors = validateAuthForm("register", {
      ...EMPTY_AUTH_FORM,
      email: "user@example.com",
      password: "short",
      confirmPassword: "another",
    });

    expect(errors.password).toBeTruthy();
    expect(errors.confirmPassword).toBeTruthy();
  });

  it("accepts a valid registration form", () => {
    const errors = validateAuthForm("register", {
      ...EMPTY_AUTH_FORM,
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(errors).toEqual({});
  });
});

describe("validateChangePasswordForm", () => {
  it("reports missing current, short new and mismatched confirmation", () => {
    const errors = validateChangePasswordForm({
      ...EMPTY_CHANGE_PASSWORD,
      newPassword: "short",
      confirmPassword: "other",
    });

    expect(errors.currentPassword).toBeTruthy();
    expect(errors.newPassword).toBeTruthy();
    expect(errors.confirmPassword).toBeTruthy();
  });

  it("rejects reusing the current password", () => {
    const errors = validateChangePasswordForm({
      currentPassword: "password123",
      newPassword: "password123",
      confirmPassword: "password123",
    });

    expect(errors.newPassword).toBeTruthy();
  });

  it("accepts a valid password change", () => {
    const errors = validateChangePasswordForm({
      currentPassword: "password123",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    });

    expect(errors).toEqual({});
  });
});
