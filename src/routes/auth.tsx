import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in · Job Agent" },
    { name: "description", content: "Sign in or create your Job Agent account." },
    { property: "og:title", content: "Sign in · Job Agent" },
    { property: "og:description", content: "Access your matched jobs and drafts." },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You're signed in.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Job Agent</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your matches and drafts.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-3">
                <FormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                <Button className="w-full" onClick={signIn} disabled={busy || !email || !password}>{busy ? "…" : "Sign in"}</Button>
              </TabsContent>
              <TabsContent value="signup" className="space-y-3">
                <FormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                <Button className="w-full" onClick={signUp} disabled={busy || !email || password.length < 6}>{busy ? "…" : "Create account"}</Button>
                <p className="text-xs text-muted-foreground">Password must be at least 6 characters.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormFields({ email, password, setEmail, setPassword }: {
  email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
    </>
  );
}


