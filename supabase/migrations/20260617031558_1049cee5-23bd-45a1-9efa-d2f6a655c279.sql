
ALTER TABLE public.orders
  ALTER COLUMN customer_email DROP NOT NULL,
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN shipping_address DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text;
