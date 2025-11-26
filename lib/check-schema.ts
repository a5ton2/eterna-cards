import { supabase } from './supabaseClient';

// Check table structure
export async function checkTableStructure() {
  try {
    // Get column information for purchaseorders table
    const { data, error } = await supabase
      .from('purchaseorders')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Columns in purchaseorders table:', Object.keys(data[0]));
    } else {
      console.log('No data in purchaseorders table');
    }
  } catch (err) {
    console.error('Failed to check table structure:', err);
  }
}
