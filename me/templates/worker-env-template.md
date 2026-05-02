# Worker Environment Variables Template

Create `worker/.env` with these variables. Never commit this file.

```env
# Supabase — use the SERVICE ROLE key (not anon key) for the worker
# Service role bypasses RLS, which is required for the worker to read all users' integrations
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption — must match the ENCRYPTION_KEY used in the Next.js app
# Both must be identical or decryption of stored API keys will fail
ENCRYPTION_KEY=your-32-byte-hex-or-base64-encryption-key

# Email (Resend)
RESEND_API_KEY=re_your_api_key

# Browser Push Notifications (Web Push API)
# Generate a VAPID key pair once: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:alerts@yourdomain.com

# Optional: Sentry error monitoring for the worker
# SENTRY_DSN=https://...
```

## Key Notes

### SUPABASE_SERVICE_ROLE_KEY
- This is the **service role** key, not the anon key
- It bypasses RLS — the worker needs it to read *all* users' integrations
- Never expose this on the client side

### ENCRYPTION_KEY
- Must be **identical** to the key used in the Next.js app (`lib/encryption.ts`)
- If they differ, the worker can't decrypt the API keys stored in the database
- Rotate carefully — if you change this, you must re-encrypt all stored keys

### VAPID Keys
- Generate once: `npx web-push generate-vapid-keys`
- Public key must also be set as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the Next.js app
- `VAPID_SUBJECT` must be a `mailto:` or `https:` URL

### Railway Setup
In Railway, set these as environment variables in the service settings — don't deploy a `.env` file.
Use Railway's "Reference Variable" feature to share values between services (e.g. if the Next.js app also runs on Railway).
