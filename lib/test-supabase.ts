import { supabase } from './supabaseClient';

// Test function to verify Supabase connection
export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Try to list tables
    const { data, error } = await supabase
      .from('suppliers')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase test error:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase test failed:', err);
    return false;
  }
}
