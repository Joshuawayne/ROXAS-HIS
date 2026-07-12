import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  console.log("Make sure to run this script using: node --env-file=.env create_superadmin.js");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("Creating superadmin user...");
  
  const email = 'superadmin@roxas.gov.ph';
  const password = 'password123';
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { role: 'Superadmin' }
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
        console.log("User already exists! Ensuring role is Superadmin in profiles...");
        
        // Find user to get ID
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            console.error("Error listing users:", listError);
            return;
        }
        
        const existingUser = usersData.users.find(u => u.email === email);
        if (existingUser) {
             const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
                id: existingUser.id,
                email: email,
                role: 'Superadmin'
            });
            if (profileError) {
                console.error("Failed to update profile:", profileError);
            } else {
                console.log("Profile updated successfully for existing user.");
            }
        }
    } else {
        console.error("Error creating auth user:", authError);
    }
    return;
  }

  console.log("Auth user created successfully:", authData.user.id);

  // Insert into profiles table
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    email: email,
    role: 'Superadmin'
  });

  if (profileError) {
    console.error("Warning: Could not insert into profiles table. It might not exist yet or have different schema.", profileError.message);
  } else {
    console.log("Inserted into profiles table successfully.");
  }
  
  console.log(`\nSuccess! You can now log in with:\nEmail: ${email}\nPassword: ${password}`);
}

main();
