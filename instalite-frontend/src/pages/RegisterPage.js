import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    login: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    birthday: "",
    affiliation: "",
    profile_image_url: "",
    hashtag_text: ""
  });

  const [error, setError] = useState("");
  const [passwordWarning, setPasswordWarning] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    symbol: false,
  });

  const navigate = useNavigate();

  function validatePassword(password) {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));

    if (name === "password") {
      setPasswordWarning(validatePassword(value));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const warnings = validatePassword(formData.password);
    const allValid = Object.values(warnings).every(Boolean);
    if (!allValid) {
      setError("Password does not meet security requirements.");
      return;
    }

    const hashtags = formData.hashtag_text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const body = {
      login: formData.login,
      password: formData.password,
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      affiliation: formData.affiliation,
      birthday: formData.birthday,
      hashtags
    };

    if (formData.profile_image_url.trim()) {
      body.profileImageUrl = formData.profile_image_url.trim();
    }

    try {
      const res = await fetch("http://localhost:3030/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Register error payload:", data);
        setError(data.error || "Registration failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      navigate("/profile");
    } catch (err) {
      console.error("Register exception:", err);
      setError("Something went wrong");
    }
  };

  return (
    <div className="auth-form">
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <input name="login" placeholder="Username" value={formData.login} onChange={handleChange} required />

        <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
          <strong>Password Requirements:</strong> Must be at least 8 characters and include one uppercase letter, one lowercase letter, one number, and one special character.
        </p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <ul className="password-rules">
          <li style={{ color: passwordWarning.length ? "green" : "red" }}>
            At least 8 characters
          </li>
          <li style={{ color: passwordWarning.upper ? "green" : "red" }}>
            Contains an uppercase letter
          </li>
          <li style={{ color: passwordWarning.lower ? "green" : "red" }}>
            Contains a lowercase letter
          </li>
          <li style={{ color: passwordWarning.number ? "green" : "red" }}>
            Contains a number
          </li>
          <li style={{ color: passwordWarning.symbol ? "green" : "red" }}>
            Contains a special character
          </li>
        </ul>

        <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
        <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
        <input type="date" name="birthday" placeholder="Birthday" value={formData.birthday} onChange={handleChange} required />
        <input name="affiliation" placeholder="Affiliation" value={formData.affiliation} onChange={handleChange} />
        <input name="hashtag_text" placeholder="Hashtags (comma-separated)" value={formData.hashtag_text} onChange={handleChange} />

        {error && <div className="error">{error}</div>}

        <button type="submit">Register</button>
      </form>

      <button onClick={() => navigate("/login")}>Back to Login</button>
    </div>
  );
}
