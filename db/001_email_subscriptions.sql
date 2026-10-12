CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  consented_at timestamptz NOT NULL DEFAULT now(),
  consent_version varchar(40) NOT NULL,
  CONSTRAINT email_subscriptions_normalized CHECK (email = lower(btrim(email)))
);
