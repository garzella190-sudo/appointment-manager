'use server';

import { createAdminClient } from '@/utils/supabase/admin';

export async function createUserAction(formData: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'istruttore' | 'segreteria';
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      role: formData.role,
      full_name: formData.full_name,
    },
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return { error: error.message };
  }

  return { success: true, user: data.user };
}

export async function listUsersAction() {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error listing users:', error.message);
    return { error: error.message };
  }

  return { users: data.users };
}
