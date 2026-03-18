const SUPABASE_URL = "https://kkanqsbzugnispmeswyf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7_6_sjcirZj5EGdcvJz7yA_RpufcVXe";

if (!window.supabase) {
  console.error("Supabase SDK nao carregado.");
}

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
