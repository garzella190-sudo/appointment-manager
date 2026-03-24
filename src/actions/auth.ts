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

export async function updateUserAction(userId: string, data: { 
  email?: string;
  password?: string;
  full_name?: string;
  role?: string;
  istruttore_id?: string | null;
}) {
  const supabase = createAdminClient();
  
  const updatePayload: any = {};
  if (data.email) updatePayload.email = data.email;
  if (data.password) updatePayload.password = data.password;

  // Metadata update logic
  const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
  const existingMetadata = userRecord?.user?.user_metadata || {};

  updatePayload.user_metadata = {
    ...existingMetadata,
    ...(data.full_name && { full_name: data.full_name }),
    ...(data.role && { role: data.role }),
  };

  if (data.istruttore_id !== undefined) {
    updatePayload.user_metadata.istruttore_id = data.istruttore_id;
  }

  const { data: updated, error } = await supabase.auth.admin.updateUserById(userId, updatePayload);
  if (error) return { error: error.message };
  return { success: true, user: updated.user };
}


export async function signOutAction() {
  const supabase = await createAdminClient(); // Or use the standard server client if preferred for session
  // Actually, for signout we should use the standard server client to clear cookies
  // I'll import createClient from @/utils/supabase/server inside the function or at top
  const { createClient: createServerClient } = await import('@/utils/supabase/server');
  const supabaseServer = await createServerClient();
  await supabaseServer.auth.signOut();
  return { success: true };
}

export async function deleteUserAction(userId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error('Error deleting user:', error.message);
      return { error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('Fatal user deletion error:', err);
    return { error: err.message || "Errore imprevisto lato server." };
  }
}
