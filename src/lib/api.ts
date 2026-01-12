/**
 * API Layer - Unified interface for data access
 * 
 * This module automatically selects the backend:
 * - If VITE_SUPABASE_URL is set: Uses Supabase (production)
 * - If VITE_API_URL is set: Uses Express server (legacy/local)
 * - Otherwise: Falls back to Express server on current hostname
 */

// Check which backend to use
const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export types
export type { ApiExpense, ApiSubcategory } from './api-supabase';

// Conditionally export the correct implementation
let expenseApi: typeof import('./api-supabase').expenseApi;
let subcategoryApi: typeof import('./api-supabase').subcategoryApi;
let statsApi: typeof import('./api-supabase').statsApi;
let healthCheck: typeof import('./api-supabase').healthCheck;

if (useSupabase) {
  // Use Supabase
  console.log('🚀 Using Supabase backend');
  const supabaseApi = await import('./api-supabase');
  expenseApi = supabaseApi.expenseApi;
  subcategoryApi = supabaseApi.subcategoryApi;
  statsApi = supabaseApi.statsApi;
  healthCheck = supabaseApi.healthCheck;
} else {
  // Use Express server
  console.log('🔧 Using Express backend');
  const expressApi = await import('./api-express');
  expenseApi = expressApi.expenseApi;
  subcategoryApi = expressApi.subcategoryApi;
  statsApi = expressApi.statsApi;
  healthCheck = expressApi.healthCheck;
}

export { expenseApi, subcategoryApi, statsApi, healthCheck };
