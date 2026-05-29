import { useState } from "react";
import type { FormEvent } from "react";

import type { AuthUser } from "@linvo-ai/shared";

import type { RuntimeResponseMessage } from "../lib/runtime-messages";

interface AuthViewProps {
  message?: string | undefined;
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthView({ message, onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(message ?? "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await chrome.runtime.sendMessage({
        request: mode === "login" ? { email, password } : { email, name: name || undefined, password },
        type: mode === "login" ? "auth/login" : "auth/register"
      }) as RuntimeResponseMessage;

      if (!response.ok || !("response" in response)) {
        setError(response.ok ? "Resposta inesperada." : response.error.message);
        return;
      }

      if ("user" in response.response) {
        onAuthenticated(response.response.user);
        return;
      }

      setError("Resposta inesperada.");
    } catch {
      setError("Nao foi possivel entrar agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-panel">
      <h1>Linvo AI</h1>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        {mode === "register" ? (
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        ) : null}
        <label>
          Senha
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            type="password"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button disabled={pending} type="submit">
          {pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
      </form>
      <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Criar conta" : "Ja tenho conta"}
      </button>
    </section>
  );
}
