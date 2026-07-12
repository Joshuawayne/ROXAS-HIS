import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log("Attempting to log in as superadmin...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'superadmin@roxas.gov.ph',
    password: 'password123',
  });

  if (error) {
    console.error("LOGIN FAILED:", error.message);
    console.error("FULL ERROR OBJECT:", JSON.stringify(error, null, 2));
  } else {
    console.log("LOGIN SUCCESS! Session:", data.session ? "Active" : "None");
  }
}

testLogin();
