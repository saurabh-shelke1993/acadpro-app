import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './login';

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

  if (!session) {
    return <Login />;
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1 style={{ color: '#1a73e8' }}>Welcome to AcadPro! 🎉</h1>
      <p>Logged in as: {session.user.email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          padding: '10px 20px',
          backgroundColor: '#e53935',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginTop: '20px',
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;