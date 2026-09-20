"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { loginAction, type LoginState } from "./actions"

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Welcome back</CardTitle>
        <CardDescription>Sign in to pick up where you left off.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <GoogleSignInButton />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </CardContent>

      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
        </CardContent>

        <CardFooter className="mt-5 flex flex-col items-stretch gap-4 border-t pt-5">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
