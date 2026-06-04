const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'AcadPro API is running!' });
});

// Test Supabase connection
app.get('/test-db', async (req, res) => {
  const { data, error } = await supabase.from('academies').select('*');
  if (error) return res.json({ error: error.message });
  res.json({ data });
});

app.listen(PORT, () => {
  console.log(`AcadPro server running on port ${PORT}`);
});