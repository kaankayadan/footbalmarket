"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function MakeAdminPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Check if the user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (session?.user?.email) {
        try {
          const response = await fetch("/api/user/me");
          if (response.ok) {
            const userData = await response.json();
            setIsAdmin(userData.isAdmin);
            
            if (!userData.isAdmin) {
              toast({
                title: "Access Denied",
                description: "You do not have permission to access the admin panel.",
                variant: "destructive",
              });
              redirect("/");
            }
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          redirect("/");
        }
      }
    };

    if (status !== "loading") {
      checkAdminStatus();
    }
  }, [session, status, toast]);

  if (status === "loading") {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin) {
    redirect("/");
  }

  const handleMakeAdmin = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to make user an admin");
      }

      const data = await response.json();

      toast({
        title: "Success!",
        description: data.message,
      });

      setEmail("");
    } catch (error) {
      console.error("Make admin error:", error);
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "There was an error making the user an admin. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md py-8">
      <div className="space-y-2 mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Back to Admin Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Make User Admin</h1>
        <p className="text-muted-foreground">
          Grant admin privileges to a user by email
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Make Admin</CardTitle>
          <CardDescription>
            Enter the email of the user you want to make an admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleMakeAdmin}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Make Admin"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}