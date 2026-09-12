"use client";
import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { loginAction, type ActionState } from "@/app/admin/actions";
const initial: ActionState = {};
export function LoginForm() { const [state, action, pending] = useActionState(loginAction, initial); return <form action={action} className="admin-form login-form"><label>Username or email<input name="identifier" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} /></label>{state.error && <div className="notice error" role="alert">{state.error}</div>}<button className="button primary" disabled={pending}>{pending ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}{pending ? "Signing in…" : "Sign in"}</button></form>; }
