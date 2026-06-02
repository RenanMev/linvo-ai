import { useState } from "react";
import type { FormEvent } from "react";

import type { AuthUser } from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { RuntimeResponseMessage } from "../lib/runtime-messages";

interface AuthViewProps {
  message?: string | undefined;
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = "forgot" | "login" | "register" | "reset";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Linvo AI</CardTitle>
        <CardDescription>
          {mode === "register"
            ? "Crie sua conta para salvar contatos."
            : mode === "forgot"
              ? "Gere um codigo local para redefinir sua senha."
              : mode === "reset"
                ? "Informe o codigo e sua nova senha."
                : "Entre para continuar identificando clientes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            {mode !== "reset" ? (
              <Field>
                <FieldLabel htmlFor="auth-email">Email</FieldLabel>
                <Input
                  id="auth-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                />
              </Field>
            ) : null}
            {mode === "register" ? (
              <Field>
                <FieldLabel htmlFor="auth-name">Nome</FieldLabel>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            ) : null}
            {mode === "reset" ? (
              <Field>
                <FieldLabel htmlFor="auth-reset-code">Codigo</FieldLabel>
                <Input
                  id="auth-reset-code"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </Field>
            ) : null}
            {mode !== "forgot" ? (
              <Field>
                <FieldLabel htmlFor="auth-password">
                  {mode === "reset" ? "Nova senha" : "Senha"}
                </FieldLabel>
                <Input
                  id="auth-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  type="password"
                  required
                />
              </Field>
            ) : null}
            {notice ? (
              <Alert variant="info">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button disabled={pending} type="submit" variant="linvo">
              {pending ? "Aguarde..." : submitLabel(mode)}
            </Button>
          </FieldGroup>
        </form>
        <div className="grid gap-2">
          {mode === "login" ? (
            <>
              <Button variant="ghost" type="button" onClick={() => setMode("register")}>
                Criar conta
              </Button>
              <Button variant="ghost" type="button" onClick={() => setMode("forgot")}>
                Esqueci minha senha
              </Button>
            </>
          ) : (
            <Button variant="ghost" type="button" onClick={() => setMode("login")}>
              {mode === "register" ? "Ja tenho conta" : "Voltar para login"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
