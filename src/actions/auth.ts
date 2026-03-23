'use server';

import { createAdminClient } from '@/utils/supabase/admin';

export async function createUserAction(formData: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'istruttore' | 'segreteria';
}) {
  try {
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
  } catch (err: any) {
    console.error('Fatal user creation error:', err);
    return { error: err.message || "Errore imprevisto lato server." };
  }
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

export async function updateUserAction(userId: string, metadata: { istruttore_id?: string | null }) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });

  if (error) {
    console.error('Error updating user:', error.message);
    return { error: error.message };
  }

  return { success: true, user: data.user };
}

