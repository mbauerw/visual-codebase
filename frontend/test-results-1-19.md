# Frontend Test Fixes - January 19, 2026

## Summary

Fixed 31 test failures across 3 test files. All 299 tests now pass.

## Test Files Modified

### 1. `src/hooks/useAuth.test.ts` (1 failure fixed)

**Issue:** The `resetPassword` test expected `resetPasswordForEmail` to be called with only an email argument, but the implementation was updated to include a `redirectTo` option.

**Fix:** Updated the test to expect both the email and the `redirectTo` option:

```typescript
// Before
expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');

// After
expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
  'test@example.com',
  { redirectTo: 'http://localhost:3000/auth/reset-password' }
);
```

### 2. `src/components/__tests__/AuthModal.test.tsx` (29 failures fixed)

**Issue:** The AuthModal component UI was redesigned with significant changes:
- Title changed from "Authentication" to dynamic titles ("Welcome Back", "Create Account", "Reset Password")
- Tab buttons are now styled `<button>` elements instead of MUI tabs with `role="tab"`
- Input fields use placeholders instead of label associations
- Submit button text changed ("Sign In" vs "Create Account" vs "Send Reset Link")
- OAuth buttons show on both Sign In and Sign Up tabs (previously only Sign In)
- Loading indicator changed from MUI CircularProgress to Lucide Loader2 icon

**Fixes:**
1. Changed text assertions from "Authentication" to tab-specific titles
2. Used `getByPlaceholderText` instead of `getByLabelText` for form inputs
3. Created helper function `getSubmitButton()` to find submit button by `type="submit"` attribute (avoiding conflicts with tab buttons)
4. Updated button name assertions to match new text ("Create Account" instead of "Sign Up", "Send Reset Link" instead of "Reset Password")
5. Fixed OAuth button tests to use "GitHub" instead of "Continue with GitHub"
6. Updated loading state tests to check for "Please wait..." text
7. Used unique subtitle text for tab switch assertions to avoid multiple element matches

### 3. `src/pages/__tests__/AuthCallback.test.tsx` (1 failure fixed)

**Issue:** The test for storing the provider token in localStorage expected `localStorage.setItem` to be called, but the implementation checks `session.user.app_metadata.provider` to determine which token key to use.

**Fix:** Added `app_metadata.provider: 'github'` to the mock session:

```typescript
// Before
user: { id: 'test-user', email: 'test@example.com' },

// After
user: {
  id: 'test-user',
  email: 'test@example.com',
  app_metadata: { provider: 'github' },
},
```

## Test Results

```
Test Files  16 passed (16)
     Tests  299 passed (299)
```

## Key Lessons

1. **Keep tests in sync with UI changes**: When components are redesigned, tests need to be updated to reflect new structure, text content, and interaction patterns.

2. **Use resilient selectors**: Prefer unique selectors like `type="submit"` or unique text content over generic button names when multiple similar elements exist.

3. **Mock data completeness**: Ensure mock objects include all fields that the implementation checks, especially nested properties like `user.app_metadata.provider`.
