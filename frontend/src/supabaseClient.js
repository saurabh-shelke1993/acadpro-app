import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ulyealhkmlorsbdiknrh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseWVhbGhrbWxvcnNiZGlrbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODk3MTEsImV4cCI6MjA5NjE2NTcxMX0.gAYnjECHmCk4HrmHN9zIJ3-m7-I5QyEhT2Puo9IdJkw';

export const supabase = createClient(supabaseUrl, supabaseKey);