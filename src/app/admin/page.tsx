"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [markets, setMarkets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Make Admin State
  const [makeAdminLoading, setMakeAdminLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  
  // Create Market State
  const [createMarketLoading, setCreateMarketLoading] = useState(false);
  const [marketTitle, setMarketTitle] = useState("");
  const [marketDescription, setMarketDescription] = useState("");
  const [marketCategory, setMarketCategory] = useState("");
  const [marketRules, setMarketRules] = useState("");
  const [marketOutcomes, setMarketOutcomes] = useState([
    { title: "", description: "" },
    { title: "", description: "" }
  ]);
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    description?: string;
    category?: string;
    rules?: string;
    outcomes?: string;
  }>({});

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
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (status !== "loading") {
      checkAdminStatus();
    }
  }, [session, status, toast]);

  // Fetch markets
  useEffect(() => {
    const fetchMarkets = async () => {
      if (isAdmin) {
        try {
          const response = await fetch("/api/markets?limit=100");
          if (response.ok) {
            const data = await response.json();
            setMarkets(data.markets);
          }
        } catch (error) {
          console.error("Error fetching markets:", error);
        }
      }
    };

    if (isAdmin) {
      fetchMarkets();
    }
  }, [isAdmin]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (isAdmin) {
        try {
          const response = await fetch("/api/admin/users");
          if (response.ok) {
            const data = await response.json();
            setUsers(data.users);
          }
        } catch (error) {
          console.error("Error fetching users:", error);
        }
      }
    };

    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  if (status === "loading" || isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin) {
    redirect("/");
  }
  
  // Handle market creation
  const handleCreateMarket = async () => {
    // Validate form
    const errors: {
      title?: string;
      description?: string;
      category?: string;
      rules?: string;
      outcomes?: string;
    } = {};
    
    if (!marketTitle || marketTitle.length < 5) {
      errors.title = "Title must be at least 5 characters.";
    }
    
    if (!marketDescription || marketDescription.length < 10) {
      errors.description = "Description must be at least 10 characters.";
    }
    
    if (!marketCategory) {
      errors.category = "Please select a category.";
    }
    
    if (!marketRules || marketRules.length < 20) {
      errors.rules = "Rules must be at least 20 characters.";
    }
    
    // Validate outcomes
    const validOutcomes = marketOutcomes.filter(outcome => outcome.title.trim() !== "");
    if (validOutcomes.length < 2) {
      errors.outcomes = "At least 2 outcomes with titles are required.";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      setCreateMarketLoading(true);
      setFormErrors({});

      // Create the market via API
      const response = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: marketTitle,
          description: marketDescription,
          category: marketCategory,
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          rules: marketRules,
          outcomes: marketOutcomes.filter(outcome => outcome.title.trim() !== "")
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create market");
      }

      toast({
        title: "Market created!",
        description: "Your new market has been created successfully.",
      });

      // Reset form
      setMarketTitle("");
      setMarketDescription("");
      setMarketCategory("");
      setMarketRules("");
      setMarketOutcomes([
        { title: "", description: "" },
        { title: "", description: "" }
      ]);
      
      // Refresh markets list
      const marketsResponse = await fetch("/api/markets?limit=100");
      if (marketsResponse.ok) {
        const data = await marketsResponse.json();
        setMarkets(data.markets);
      }
    } catch (error) {
      console.error("Create market error:", error);
      toast({
        title: "Market creation failed",
        description: error instanceof Error ? error.message : "There was an error creating your market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreateMarketLoading(false);
    }
  };
  
  // Handle making a user an admin
  const handleMakeAdmin = async () => {
    if (!adminEmail) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setMakeAdminLoading(true);

      const response = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
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

      setAdminEmail("");
      
      // Refresh users list
      const usersResponse = await fetch("/api/admin/users");
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Make admin error:", error);
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "There was an error making the user an admin. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMakeAdminLoading(false);
    }
  };
  
  // Handle outcome changes
  const handleOutcomeChange = (index: number, field: 'title' | 'description', value: string) => {
    const newOutcomes = [...marketOutcomes];
    newOutcomes[index][field] = value;
    setMarketOutcomes(newOutcomes);
  };
  
  // Add new outcome
  const addOutcome = () => {
    setMarketOutcomes([...marketOutcomes, { title: "", description: "" }]);
  };
  
  // Remove outcome
  const removeOutcome = (index: number) => {
    if (marketOutcomes.length <= 2) {
      return; // Keep at least 2 outcomes
    }
    const newOutcomes = [...marketOutcomes];
    newOutcomes.splice(index, 1);
    setMarketOutcomes(newOutcomes);
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Manage markets, users, and system settings
        </p>
      </div>

      <Tabs defaultValue="markets" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="create-market">Create Market</TabsTrigger>
          <TabsTrigger value="make-admin">Make Admin</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="markets">
          <Card>
            <CardHeader>
              <CardTitle>Markets Management</CardTitle>
              <CardDescription>
                View and manage all prediction markets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {markets.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Title</th>
                          <th className="text-left py-2 px-4">Category</th>
                          <th className="text-left py-2 px-4">End Date</th>
                          <th className="text-left py-2 px-4">Status</th>
                          <th className="text-left py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.map((market) => (
                          <tr key={market.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{market.title}</td>
                            <td className="py-2 px-4">{market.category}</td>
                            <td className="py-2 px-4">
                              {new Date(market.endDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${market.isResolved ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {market.isResolved ? 'Resolved' : 'Active'}
                              </span>
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex gap-2">
                                <Link href={`/admin/markets/${market.id}`}>
                                  <Button variant="outline" size="sm">Edit</Button>
                                </Link>
                                {!market.isResolved && (
                                  <Link href={`/admin/markets/${market.id}/resolve`}>
                                    <Button variant="outline" size="sm">Resolve</Button>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No markets found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage user accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Name</th>
                          <th className="text-left py-2 px-4">Email</th>
                          <th className="text-left py-2 px-4">Balance</th>
                          <th className="text-left py-2 px-4">Admin</th>
                          <th className="text-left py-2 px-4">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{user.name}</td>
                            <td className="py-2 px-4">{user.email}</td>
                            <td className="py-2 px-4">${typeof user.balance === 'number' ? user.balance.toFixed(2) : (user.balance?.toString() || "0.00")}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {user.isAdmin ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="py-2 px-4">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No users found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-market">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Market</CardTitle>
              <CardDescription>
                Create a new prediction market for football fans to trade on
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Market Title</Label>
                  <Input
                    id="title"
                    placeholder="E.g., Premier League Winner 2025/26"
                    value={marketTitle}
                    onChange={(e) => setMarketTitle(e.target.value)}
                    disabled={createMarketLoading}
                  />
                  {formErrors.title && (
                    <p className="text-sm text-red-500">{formErrors.title}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this market is about"
                    value={marketDescription}
                    onChange={(e) => setMarketDescription(e.target.value)}
                    disabled={createMarketLoading}
                  />
                  {formErrors.description && (
                    <p className="text-sm text-red-500">{formErrors.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    onValueChange={(value: string) => setMarketCategory(value)}
                    value={marketCategory}
                    disabled={createMarketLoading}
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
                  {formErrors.category && (
                    <p className="text-sm text-red-500">{formErrors.category}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rules">Resolution Rules</Label>
                  <Textarea
                    id="rules"
                    placeholder="Specify the exact conditions under which this market will be resolved"
                    value={marketRules}
                    onChange={(e) => setMarketRules(e.target.value)}
                    disabled={createMarketLoading}
                  />
                  {formErrors.rules && (
                    <p className="text-sm text-red-500">{formErrors.rules}</p>
                  )}
                </div>

                <div className="space-y-4 mt-6">
                  <h3 className="text-lg font-medium">Outcomes</h3>
                  <p className="text-sm text-muted-foreground">Define at least two possible outcomes for your market</p>
                  
                  {marketOutcomes.map((outcome, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Outcome {index + 1}</h3>
                        {index >= 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOutcome(index)}
                            disabled={createMarketLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`outcome-${index}-title`}>Title</Label>
                        <Input
                          id={`outcome-${index}-title`}
                          placeholder="E.g., Manchester City"
                          value={outcome.title}
                          onChange={(e) => handleOutcomeChange(index, 'title', e.target.value)}
                          disabled={createMarketLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`outcome-${index}-description`}>Description (Optional)</Label>
                        <Input
                          id={`outcome-${index}-description`}
                          placeholder="Additional details about this outcome"
                          value={outcome.description}
                          onChange={(e) => handleOutcomeChange(index, 'description', e.target.value)}
                          disabled={createMarketLoading}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={addOutcome}
                    disabled={createMarketLoading}
                  >
                    Add Outcome
                  </Button>

                  {formErrors.outcomes && (
                    <p className="text-sm text-red-500 mt-2">{formErrors.outcomes}</p>
                  )}
                </div>

                <Button 
                  className="w-full mt-6" 
                  onClick={handleCreateMarket}
                  disabled={createMarketLoading}
                >
                  {createMarketLoading ? "Creating Market..." : "Create Market"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="make-admin">
          <Card>
            <CardHeader>
              <CardTitle>Make User Admin</CardTitle>
              <CardDescription>
                Grant admin privileges to a user by email
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
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    disabled={makeAdminLoading}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleMakeAdmin}
                  disabled={makeAdminLoading}
                >
                  {makeAdminLoading ? "Processing..." : "Make Admin"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">System settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}