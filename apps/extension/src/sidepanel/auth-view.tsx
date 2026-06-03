import { useState } from "react";
import type { FormEvent } from "react";

import type { AuthUser } from "@linvo-ai/shared";

import {
  ArrowLeftIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  LogInIcon,
  MailIcon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
  type LucideIcon
} from "lucide-react";

import type { RuntimeResponseMessage } from "../lib/runtime-messages";

interface AuthViewProps {
  message?: string | undefined;
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = "forgot" | "login" | "register" | "reset";

interface AuthModeCopy {
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}

const AUTH_MODE_COPY: Record<AuthMode, AuthModeCopy> = {
  forgot: {
    description: "Gere um codigo seguro para trocar sua senha.",
    eyebrow: "Recuperacao",
    icon: KeyRoundIcon,
    title: "Recupere o acesso"
  },
  login: {
    description: "Entre para identificar clientes e manter o contexto do atendimento.",
    eyebrow: "Acesso seguro",
    icon: LogInIcon,
    title: "Entre na Linvo AI"
  },
  register: {
    description: "Crie sua conta para salvar contatos e historico de atendimento.",
    eyebrow: "Nova conta",
    icon: UserPlusIcon,
    title: "Comece sua base"
  },
  reset: {
    description: "Informe o codigo recebido e defina uma nova senha.",
    eyebrow: "Senha nova",
    icon: ShieldCheckIcon,
    title: "Redefina a senha"
  }
};

function submitLabel(mode: AuthMode): string {
  if (mode === "forgot") {
    return "Gerar codigo";
  }

  if (mode === "register") {
    return "Cadastrar";
  }

  if (mode === "reset") {
    return "Redefinir senha";
  }

  return "Entrar";
}

export function AuthView({ message, onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [error, setError] = useState(message ?? "");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");

    try {
      if (mode === "forgot") {
        const response = await chrome.runtime.sendMessage({
          request: { email },
          type: "auth/password-reset.request"
        }) as RuntimeResponseMessage;

        if (!response.ok || !("response" in response)) {
          setError(response.ok ? "Resposta inesperada." : response.error.message);
          return;
        }

        if ("resetCode" in response.response && response.response.resetCode) {
          setResetCode(response.response.resetCode);
          setMode("reset");
          setNotice(`Codigo local gerado: ${response.response.resetCode}`);
          return;
        }

        setMode("login");
        setNotice("Se este email estiver cadastrado, voce recebera instrucoes para redefinir a senha.");
        return;
      }

      if (mode === "reset") {
        const response = await chrome.runtime.sendMessage({
          request: { password, resetCode },
          type: "auth/password-reset.confirm"
        }) as RuntimeResponseMessage;

        if (!response.ok) {
          setError(response.error.message);
          return;
        }

        setMode("login");
        setPassword("");
        setResetCode("");
        setNotice("Senha redefinida. Entre com a nova senha.");
        return;
      }

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
      setError("Nao foi possivel completar a acao agora.");
    } finally {
      setPending(false);
    }
  }

  const copy = AUTH_MODE_COPY[mode];
  const ModeIcon = copy.icon;

  return (
    <section className="linvo-auth-card" aria-labelledby="auth-title">
      <div className="linvo-auth-hero">
        <div className="linvo-auth-mark" aria-hidden="true">
          <ModeIcon className="size-5" />
        </div>
        <div className="linvo-auth-copy">
          <span>{copy.eyebrow}</span>
          <h1 id="auth-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="linvo-auth-chips" aria-label="Recursos da conta">
          <span className="linvo-auth-chip linvo-auth-chip-active">IA assistiva</span>
          <span className="linvo-auth-chip">Contatos salvos</span>
          <span className="linvo-auth-chip">Contexto</span>
        </div>
      </div>

      <div className="linvo-auth-tabs" aria-label="Modo de autenticacao">
        <button
          aria-pressed={mode === "login"}
          className={mode === "login" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("login")}
        >
          Entrar
        </button>
        <button
          aria-pressed={mode === "register"}
          className={mode === "register" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("register")}
        >
          Criar conta
        </button>
      </div>

      <form className="linvo-auth-form" onSubmit={(event) => void submit(event)}>
        {mode !== "reset" ? (
          <label className="linvo-auth-field" htmlFor="auth-email">
            <span>Email</span>
            <span className="linvo-auth-input">
              <MailIcon className="size-4" aria-hidden="true" />
              <input
                id="auth-email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </span>
          </label>
        ) : null}

        {mode === "register" ? (
          <label className="linvo-auth-field" htmlFor="auth-name">
            <span>Nome</span>
            <span className="linvo-auth-input">
              <UserIcon className="size-4" aria-hidden="true" />
              <input
                id="auth-name"
                autoComplete="name"
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </span>
          </label>
        ) : null}

        {mode === "reset" ? (
          <label className="linvo-auth-field" htmlFor="auth-reset-code">
            <span>Codigo</span>
            <span className="linvo-auth-input">
              <KeyRoundIcon className="size-4" aria-hidden="true" />
              <input
                id="auth-reset-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                placeholder="000000"
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </span>
          </label>
        ) : null}

        {mode !== "forgot" ? (
          <label className="linvo-auth-field" htmlFor="auth-password">
            <span>{mode === "reset" ? "Nova senha" : "Senha"}</span>
            <span className="linvo-auth-input">
              <LockKeyholeIcon className="size-4" aria-hidden="true" />
              <input
                id="auth-password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Minimo de 8 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                type="password"
                required
              />
            </span>
          </label>
        ) : null}

        {notice ? (
          <div className="linvo-auth-alert linvo-auth-alert-info" role="status" aria-live="polite">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="linvo-auth-alert linvo-auth-alert-error" role="alert">
            {error}
          </div>
        ) : null}

        <button className="linvo-auth-submit" disabled={pending} type="submit">
          {pending ? "Aguarde..." : submitLabel(mode)}
        </button>
      </form>

      <div className="linvo-auth-actions">
        {mode === "login" ? (
          <button type="button" onClick={() => setMode("forgot")}>
            Esqueci minha senha
          </button>
        ) : (
          <button type="button" onClick={() => setMode("login")}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {mode === "register" ? "Ja tenho conta" : "Voltar para login"}
          </button>
        )}
      </div>
    </section>
  );
}
