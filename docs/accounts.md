# Nuance accounts

Email-and-password authentication, a private display-name profile, and explicit composition saving use Supabase. Browsing, editing, and PNG downloads work without an account. The header account button opens a native modal with separate Sign in, Create account, and Forgot password forms. Once signed in, the profile dialog has Profile and Compositions tabs, plus sign-out and an email-based password reset action.

## Connect the existing project

1. Inspect the existing project's schema before applying `supabase/migrations/202611020001_accounts.sql`. It adds `public.profiles` and `public.compositions`; if those names already exist, reconcile the schema first. The migration is transactional and does not drop or replace existing tables.
2. Apply the migration through Supabase migrations or the SQL editor.
3. Copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's Connect/API settings, and restart Vite. Use the browser-safe publishable key. Never put a secret or service-role key in a `VITE_` variable. Local environment files are ignored by Git.
4. Enable Email authentication and new-user registration. Keep email confirmation enabled. In Authentication → Email Templates, use `supabase/templates/confirmation.html` for **Confirm signup** and `supabase/templates/recovery.html` for **Reset password**. These templates use confirmation links, replacing the earlier code-only template. Both must contain a link to `{{ .ConfirmationURL }}`:

   ```html
   <p><a href="{{ .ConfirmationURL }}">Continue to Nuance</a></p>
   ```

5. In Authentication → URL Configuration, set the Site URL to the actual app origin. Allow the app's callback URLs for both `?account=confirm` and `?account=recovery`, including your local development origin. For a root deployment at port 5173 these are `http://localhost:5173/?account=confirm` and `http://localhost:5173/?account=recovery`. Use the actual hostname, port, and path for your setup. Add the matching HTTPS production URLs before deploying. The app deliberately excludes unrelated query parameters and URL fragments from redirect targets. See [password-based auth](https://supabase.com/docs/guides/auth/passwords).
6. The app requires at least 12 characters for newly created/reset passwords and matching confirmation. Set the project's password minimum to 12 as well so server-side enforcement matches the UI. Existing users can still sign in with their existing passwords. Supabase enforces any additional configured password rules; see [password security](https://supabase.com/docs/guides/auth/password-security).
7. Configure an email sender/SMTP suitable for your users. Supabase's default sender has delivery restrictions; see [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

The app stays usable when environment configuration is absent. It explains that sign-in is being set up instead of simulating an authenticated session.

## Behavior and data

- Returning users sign in with email and password. New users supply display name, email, password, and confirmation. If the project requires email confirmation, the app shows a confirmation notice and a resend action instead of assuming an authenticated session. Confirmation links automatically open the account dialog on return.
- Forgot password sends a reset link and displays a generic acknowledgement that does not reveal whether the email has an account. A valid Supabase `PASSWORD_RECOVERY` event opens the new-password form. Password mismatch, weak-password, and expired/invalid-link errors are handled without reporting success. The reset form can be restored after a refresh within the same tab; a session-only owner marker contains no password or authentication token and is cleared on completion, dismissal, sign-out, or account change.
- Passwords are passed directly to Supabase Auth. They are never stored in composition documents, profile rows, application logs, or custom browser storage. Password fields support password managers and accessible show/hide controls. See [Supabase password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
- Existing accounts created through the earlier email-code flow use Forgot password, or Reset password in their profile, to establish a password for the same account. Saved composition ownership is unchanged. Resend/reset requests have a 60-second UI cooldown in addition to server-side limits.
- Auth sessions persist through the Supabase browser client. Profiles contain only the user's ID, display name, and update timestamp. A missing profile row is initialized after authentication, using the sign-up display name. Existing profile names are preserved. Email remains managed by Supabase Auth and is read-only in the profile dialog.
- The Profile tab contains initials, display name, email, Save changes, and Cancel. The Compositions tab contains saved work. Tabs support arrow keys, Home, and End; closing the modal restores keyboard focus to its trigger.
- “Save to account” explicitly stores the current editable document. Repeated saves update the same document ID. Opening a saved composition preserves that ID. “Download PNG” remains a separate action.
- Saved JSON is validated through the existing serialization boundary before saving and after loading. Layout, proportions, colors, provenance, and stable IDs are preserved.
- Row-level security restricts both tables to the authenticated owner. Anonymous roles receive no table privileges. No service-role client is used in the application.
- Sign-out/account changes clear in-memory editor drafts and private library state. Guest work is retained when signing in so it can be saved. Unsaved changes remain local to the current page session.
- Profile and library loads are guarded against responses from a previous account. Failed requests show retryable errors; failed saves do not report success.

## Validation

`npm test` runs the editor/document tests and tests the exact migration in a local PostgreSQL runtime (PGlite, development-only). The database tests exercise owner upserts, cross-account read/write denial, owner-transfer denial, anonymous denial, and document/profile constraints. They do not connect to a remote project or send email.

Local Chrome checks with mocked Supabase responses cover sign-up/confirmation notices, password mismatch and show/hide, invalid-login retry, guest-draft preservation, save/library access, recovery callbacks, recovery-form restoration after refresh, password updates, sign-in with the new password, expired-link rejection/retry, and confirmation callbacks on desktop/mobile. These checks do not send real emails or change the remote project's Auth configuration.

After configuring the real project, verify confirmation and reset email delivery, password sign-in, refresh/session restoration, profile updates, save/reopen/edit/resave, and account isolation. Live email delivery and redirect allowlists still require verification against the project's settings.
