import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const Login = () => {
  const [email, setEmail] = useState("");

  return (
    <div>
      <h1>Login Component Working</h1>

      <input
        type="email"
        placeholder="Enter Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  );
};

export default Login;