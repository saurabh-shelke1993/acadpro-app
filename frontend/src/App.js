import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './login';
import Dashboard from './Dashboard';
import ParentPortal from './ParentPortal';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // Show Parent Portal if URL has /parent
  if (window.location.pathname === '/parent') {
    return <ParentPortal />;
  }

  if (!session) {
    return <Login />;
  }

  return <Dashboard session={session} />;
}

export default App;