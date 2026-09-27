/* Motoworx Winton — Supabase connection.
   The publishable key is safe in the browser: row level security decides what
   anyone can actually read or write. Public visitors can read bikes and submit
   an enquiry, nothing else. Staff sign in on /admin to manage stock. */
window.MOTOWORX = {
  supabaseUrl: 'https://bffddgypusotsdwpaliy.supabase.co',
  supabaseKey: 'sb_publishable_p1PXdYSrDVuqopFeO0HWTA_CG7-l-WV',
  phone: '027 338 4620',
  phoneHref: 'tel:+64273384620',
  /* Website enquiries are emailed here as well as saved for /admin.
     Split so the address is not sitting whole in the page for scrapers. */
  enquiryEmail: { user: 'justin', domain: 'mworx.nz' }
};
