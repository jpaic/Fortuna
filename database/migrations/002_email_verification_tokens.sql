-- 002_email_verification_tokens.sql
-- Short-lived tokens for account confirmation and password reset flows,
-- sent through Resend. One row per outstanding token.

CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  purpose     VARCHAR(20) NOT NULL DEFAULT 'email_verification'
              CHECK (purpose IN ('email_verification', 'password_reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens (token);
