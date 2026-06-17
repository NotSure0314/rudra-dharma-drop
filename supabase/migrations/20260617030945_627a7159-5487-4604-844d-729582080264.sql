
-- Revoke any direct Data API access for orders and waitlist; only service_role (server functions) should touch them.
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.waitlist FROM anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.waitlist TO service_role;

-- Add restrictive deny-all policies as defense-in-depth: even if a permissive policy is added later,
-- anon/authenticated requests still cannot read or modify these tables.
DROP POLICY IF EXISTS "Deny all access to orders for non-service roles" ON public.orders;
CREATE POLICY "Deny all access to orders for non-service roles"
  ON public.orders
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to waitlist for non-service roles" ON public.waitlist;
CREATE POLICY "Deny all access to waitlist for non-service roles"
  ON public.waitlist
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
