import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const handleLogin = async () => {

    if (!email || !password) {

      alert("Enter email and password");

      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({

        email,
        password
      });

    if (error) {

      alert(error.message);

    } else {

const { data: profileData } =
  await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

localStorage.setItem(
  "acadpro_user",
  JSON.stringify(profileData)
);

      alert("Login Successful");

      navigate("/dashboard");
    }
  };

  return (

    <div style={{ padding: "30px" }}>

      <h1>AcadPro Login</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <br />
      <br />

      <button onClick={handleLogin}>
        Login
      </button>

    </div>
  );
}

export default Login;