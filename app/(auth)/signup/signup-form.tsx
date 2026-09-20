"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { signupAction, type SignupState } from "./actions"

const initialState: SignupState = {}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create your account</CardTitle>
        <CardDescription>Start a project and see where it goes.</CardDescription>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" aria-invalid={!!state.fieldErrors?.name} />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!state.fieldErrors?.email}
            />
            {state.fieldErrors?.email ? (
              <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!state.fieldErrors?.password}
            />
            {state.fieldErrors?.password ? (
              <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
            ) : (
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="mt-5 flex flex-col items-stretch gap-4 border-t pt-5">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
