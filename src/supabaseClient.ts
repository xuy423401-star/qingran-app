/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";

// Try to grab from Vite environment first or process.env if available
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = (metaEnv.VITE_SUPABASE_URL || 
                       (typeof process !== "undefined" ? process.env?.SUPABASE_URL : "") || 
                       "").trim();

const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || 
                          (typeof process !== "undefined" ? process.env?.SUPABASE_ANON_KEY : "") || 
                          "").trim();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR_") && !supabaseAnonKey.includes("YOUR_"));

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!isSupabaseConfigured) {
  console.warn("Supabase is not configured yet or keys are missing. Falling back to localStorage simulation.");
}


export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;