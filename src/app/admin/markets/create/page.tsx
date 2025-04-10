"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format } from "date-fns";

const createMarketSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  category: z.string({ required_error: "Please select a category." }),
  endDate: z.date({ required_error: "Please select an end date." }),
  rules: z.string().min(20, { message: "Rules must be at least 20 characters." }),
  outcomes: z.array(
    z.object({
      title: z.string().min(1, { message: "Outcome title is required." }),
      description: z.string().optional(),
    })
  ).min(2, { message: "At least 2 outcomes are required." }),
});

type CreateMarketFormValues = z.infer<typeof createMarketSchema>;

export default function AdminCreateMarketPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const form = useForm<CreateMarketFormValues>({
    resolver: zodResolver(createMarketSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      endDate: undefined,
      rules: "",
      outcomes: [
        { title: "", description: "" },
        { title: "", description: "" },
      ],
    },
  });

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

  async function onSubmit(data: CreateMarketFormValues) {
    try {
      setIsLoading(true);

      // Create the market via API
      const response = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create market");
      }

      toast({
        title: "Market created!",
        description: "Your new market has been created successfully.",
      });

      router.push("/admin");
    } catch (error) {
      console.error("Create market error:", error);
      toast({
        title: "Market creation failed",
        description: error instanceof Error ? error.message : "There was an error creating your market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="space-y-2 mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Back to Admin Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Create a New Market</h1>
        <p className="text-muted-foreground">
          Create a new prediction market for football fans to trade on
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Market Details</CardTitle>
            <CardDescription>
              Enter the basic details of your prediction market
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Market Title</Label>
              <Input
                id="title"
                placeholder="E.g., Premier League Winner 2025/26"
                {...form.register("title")}
                disabled={isLoading}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this market is about"
                {...form.register("description")}
                disabled={isLoading}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => form.setValue("category", value)}
                  defaultValue={form.getValues("category")}
                  disabled={isLoading}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Premier League">Premier League</SelectItem>
                    <SelectItem value="La Liga">La Liga</SelectItem>
                    <SelectItem value="Bundesliga">Bundesliga</SelectItem>
                    <SelectItem value="Serie A">Serie A</SelectItem>
                    <SelectItem value="Champions League">Champions League</SelectItem>
                    <SelectItem value="World Cup">World Cup</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        !form.getValues("endDate") ? "text-muted-foreground" : ""
                      }`}
                      disabled={isLoading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.getValues("endDate") ? (
                        format(form.getValues("endDate"), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.getValues("endDate")}
                      onSelect={(date) => form.setValue("endDate", date!)}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.endDate && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">Resolution Rules</Label>
              <Textarea
                id="rules"
                placeholder="Specify the exact conditions under which this market will be resolved"
                {...form.register("rules")}
                disabled={isLoading}
              />
              {form.formState.errors.rules && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.rules.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Outcomes</CardTitle>
            <CardDescription>
              Define at least two possible outcomes for your market
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {form.getValues("outcomes").map((_, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Outcome {index + 1}</h3>
                    {index >= 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const outcomes = [...form.getValues("outcomes")];
                          outcomes.splice(index, 1);
                          form.setValue("outcomes", outcomes);
                        }}
                        disabled={isLoading}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`outcomes.${index}.title`}>Title</Label>
                    <Input
                      id={`outcomes.${index}.title`}
                      placeholder="E.g., Manchester City"
                      {...form.register(`outcomes.${index}.title`)}
                      disabled={isLoading}
                    />
                    {form.formState.errors.outcomes?.[index]?.title && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.outcomes[index]?.title?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`outcomes.${index}.description`}>Description (Optional)</Label>
                    <Input
                      id={`outcomes.${index}.description`}
                      placeholder="Additional details about this outcome"
                      {...form.register(`outcomes.${index}.description`)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  const outcomes = [...form.getValues("outcomes")];
                  outcomes.push({ title: "", description: "" });
                  form.setValue("outcomes", outcomes);
                }}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Outcome
              </Button>

              {form.formState.errors.outcomes && !Array.isArray(form.formState.errors.outcomes) && (
                <p className="text-sm text-red-500 mt-2">
                  {form.formState.errors.outcomes.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Creating Market..." : "Create Market"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}