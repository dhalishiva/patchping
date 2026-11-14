export const SITE = {
  name: "PatchPing",
  url: "https://patchping.kriosity.in",
  // Change this to a mailbox you actually read before going public.
  contactEmail: "support@kriosity.in",
  operator: "Kriosity",
  owner: "Shiva Dhali",
  address: "42-A / BLK-S.K. EWS, Sector 66, Noida, Gautam Buddha Nagar, Uttar Pradesh 201301, India",
  legalUpdated: "15 November 2026",
};

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://vswctqwxvesjripvwsex.supabase.co";
// Publishable key: safe in the browser, access is enforced by row-level security.
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_sbr7AEivTLoW5QV9ww-WCQ_PtFPLnyT";
