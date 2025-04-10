"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Define types for our data
interface Trade {
  id: string;
  marketId: string;
  amount: number;
  price: number;
  type: string;
  createdAt: string;
  market: {
    id: string;
    title: string;
  };
  outcome: {
    id: string;
    title: string;
  };
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  createdAt: string;
}
interface HoldingWithMetrics {
  id: string;
  outcomeId: string;
  marketId: string;
  marketTitle: string;
  outcomeTitle: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPL: number;
  percentChange: number;
  isResolved: boolean;
  isWinner: boolean;
  positionType: "YES" | "NO";
}

interface MarketHoldings {
  marketId: string;
  marketTitle: string;
  isResolved: boolean;
  holdings: HoldingWithMetrics[];
  totalValue: number;
  totalPL: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalPL: number;
  plPercentage: number;
}

interface HoldingsResponse {
  holdings: MarketHoldings[];
  portfolioSummary: PortfolioSummary;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  
  const [balance, setBalance] = useState<number | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<MarketHoldings[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("100");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(true);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTradePages, setTotalTradePages] = useState(1);
  const [totalTransactionPages, setTotalTransactionPages] = useState(1);

  // Fetch user data, trades, and transactions
  useEffect(() => {
    if (session?.user) {
      // Fetch trades
      const fetchTrades = async () => {
        setIsLoadingTrades(true);
        setTradeError(null);
        
        try {
          const response = await fetch(`/api/trades?page=${currentPage}&limit=5`);
          
          if (!response.ok) {
            throw new Error("Failed to fetch trades");
          }
          
          const data = await response.json();
          setTrades(data.trades);
          setTotalTradePages(data.pagination.totalPages);
        } catch (err) {
          console.error("Error fetching trades:", err);
          setTradeError("Failed to load trades. Please try again later.");
        } finally {
          setIsLoadingTrades(false);
        }
      };
      
      // Fetch transactions
      const fetchTransactions = async () => {
        setIsLoadingTransactions(true);
        setTransactionError(null);
        
        try {
          const response = await fetch(`/api/transactions?page=${currentPage}&limit=5`);
          
          if (!response.ok) {
            throw new Error("Failed to fetch transactions");
          }
          
          const data = await response.json();
          setTransactions(data.transactions);
          setTotalTransactionPages(data.pagination.totalPages);
          
          // Get the user's balance from the first transaction (if available)
          if (data.transactions.length > 0) {
            // This is a simplified approach - in a real app, you'd have a dedicated endpoint for user data
            const userResponse = await fetch('/api/user/me');
            if (userResponse.ok) {
              const userData = await userResponse.json();
              setBalance(userData.balance);
            }
          }
        } catch (err) {
          console.error("Error fetching transactions:", err);
          setTransactionError("Failed to load transactions. Please try again later.");
        } finally {
          setIsLoadingTransactions(false);
        }
      };
      // Fetch holdings
      const fetchHoldings = async () => {
        setIsLoadingHoldings(true);
        setHoldingsError(null);
        
        try {
          const response = await fetch('/api/user/holdings');
          
          if (!response.ok) {
            throw new Error("Failed to fetch holdings");
          }
          
          const data = await response.json();
          setHoldings(data.holdings);
          setPortfolioSummary(data.portfolioSummary);
        } catch (err) {
          console.error("Error fetching holdings:", err);
          setHoldingsError("Failed to load holdings. Please try again later.");
        } finally {
          setIsLoadingHoldings(false);
        }
      };
      
      fetchTrades();
      fetchTransactions();
      fetchHoldings();
    }
  }, [session, currentPage]);

  if (status === "loading") {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    redirect("/login");
  }

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Execute the deposit via API
      const response = await fetch("/api/transactions/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(depositAmount) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process deposit");
      }

      const data = await response.json();

      toast({
        title: "Deposit successful!",
        description: `${depositAmount} coins have been added to your account.`,
      });

      // Update the balance
      setBalance(data.balance);

      // Refresh transactions and holdings
      const transactionsResponse = await fetch(`/api/transactions?page=1&limit=5`);
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData.transactions);
      setTotalTransactionPages(transactionsData.pagination.totalPages);
      
      // Refresh holdings
      const holdingsResponse = await fetch('/api/user/holdings');
      if (holdingsResponse.ok) {
        const holdingsData = await holdingsResponse.json();
        setHoldings(holdingsData.holdings);
        setPortfolioSummary(holdingsData.portfolioSummary);
      }
      
      setCurrentPage(1);

      setDepositAmount("100");
    } catch (error) {
      console.error("Deposit error:", error);
      toast({
        title: "Deposit failed",
        description: error instanceof Error ? error.message : "There was an error processing your deposit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format date to a more readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Format balance with commas
  const formatBalance = (balance: number) => {
    // Split by decimal point
    const parts = balance.toString().split('.');
    // Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // Join back with decimal point if it exists
    return parts.join('.');
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="flex items-center space-x-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
            <AvatarFallback>
              {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{session.user?.name || "User"}</h2>
            <p className="text-sm text-muted-foreground">{session.user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>Your current coin balance</CardDescription>
          </CardHeader>
          <CardContent>
            {balance !== null ? (
              <div className="text-3xl font-bold">{formatBalance(balance)} coins</div>
            ) : (
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            )}
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Deposit Amount</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="10"
                  disabled={isLoading}
                />
              </div>
              <Button className="w-full" onClick={handleDeposit} disabled={isLoading}>
                {isLoading ? "Processing..." : "Deposit Coins"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="holdings" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="holdings">Portfolio</TabsTrigger>
              <TabsTrigger value="trades">Trading History</TabsTrigger>
              <TabsTrigger value="transactions">Transaction History</TabsTrigger>
            </TabsList>

            <TabsContent value="holdings">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Holdings</CardTitle>
                  <CardDescription>
                    Your current market positions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingHoldings ? (
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-3"></div>
                          <div className="space-y-2">
                            {[...Array(2)].map((_, j) => (
                              <div key={j} className="flex justify-between items-center">
                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : holdingsError ? (
                    <div className="text-center py-4">
                      <p className="text-red-500">{holdingsError}</p>
                      <Button
                        onClick={() => setCurrentPage(1)}
                        className="mt-2"
                        variant="outline"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : holdings.length > 0 ? (
                    <div className="space-y-6">
                      {/* Portfolio Summary */}
                      {portfolioSummary && (
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold">Portfolio Summary</h3>
                            <p className={`font-bold ${portfolioSummary.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {portfolioSummary.totalPL >= 0 ? '+' : ''}{portfolioSummary.totalPL.toFixed(2)} coins
                              {' '}
                              <span className="text-xs">
                                ({portfolioSummary.plPercentage >= 0 ? '+' : ''}{portfolioSummary.plPercentage.toFixed(2)}%)
                              </span>
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Value: {portfolioSummary.totalValue.toFixed(2)} coins
                          </div>
                        </div>
                      )}
                      
                      {/* Market Holdings */}
                      {holdings.map((market) => (
                        <div key={market.marketId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-medium">{market.marketTitle}</h3>
                            <div className="text-right">
                              <p className={`font-semibold ${market.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {market.totalPL >= 0 ? '+' : ''}{market.totalPL.toFixed(2)} coins
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Value: {market.totalValue.toFixed(2)} coins
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {market.holdings.map((holding) => (
                              <div key={holding.id} className="flex justify-between items-center text-sm border-t pt-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p>{holding.outcomeTitle}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      holding.positionType === "YES" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}>
                                      {holding.positionType}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {holding.quantity.toFixed(2)} shares @ {(holding.avgPrice * 100).toFixed(1)}¢
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`${holding.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {holding.unrealizedPL >= 0 ? '+' : ''}{holding.unrealizedPL.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Current: {(holding.currentPrice * 100).toFixed(1)}¢
                                  </p>
                                  <p className="text-xs text-blue-600">
                                    {holding.isResolved
                                      ? (holding.isWinner ? "Winner! 🏆" : "Lost")
                                      : `Potential profit: ${(holding.quantity * (1 - holding.avgPrice)).toFixed(2)}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">You don't have any holdings yet. Start trading to build your portfolio!</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trades">
              <Card>
                <CardHeader>
                  <CardTitle>Trading History</CardTitle>
                  <CardDescription>
                    Your recent trading activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTrades ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-1"></div>
                            </div>
                            <div className="text-right">
                              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : tradeError ? (
                    <div className="text-center py-4">
                      <p className="text-red-500">{tradeError}</p>
                      <Button 
                        onClick={() => setCurrentPage(1)} 
                        className="mt-2"
                        variant="outline"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : trades.length > 0 ? (
                    <div className="space-y-4">
                      {trades.map((trade) => (
                        <div key={trade.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{trade.market.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                Outcome: {trade.outcome.title}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${trade.type === "BUY" ? "text-green-600" : "text-red-600"}`}>
                                {trade.type === "BUY" ? "+" : "-"}{trade.amount} coins
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Price: {Math.round(Number(trade.price) * 100)}%
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatDate(trade.createdAt)}
                          </div>
                        </div>
                      ))}

                      {/* Pagination controls */}
                      {totalTradePages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-6">
                          <Button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1}
                            variant="outline"
                            size="sm"
                          >
                            Previous
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalTradePages}
                          </span>
                          <Button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalTradePages))} 
                            disabled={currentPage === totalTradePages}
                            variant="outline"
                            size="sm"
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">You haven't made any trades yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>
                    Your recent deposits and withdrawals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTransactions ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mt-1"></div>
                            </div>
                            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : transactionError ? (
                    <div className="text-center py-4">
                      <p className="text-red-500">{transactionError}</p>
                      <Button 
                        onClick={() => setCurrentPage(1)} 
                        className="mt-2"
                        variant="outline"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : transactions.length > 0 ? (
                    <div className="space-y-4">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-medium">{transaction.type}</h3>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(transaction.createdAt)}
                              </p>
                            </div>
                            <p className={`font-semibold ${Number(transaction.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {Number(transaction.amount) >= 0 ? "+" : ""}{transaction.amount} coins
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Pagination controls */}
                      {totalTransactionPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-6">
                          <Button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1}
                            variant="outline"
                            size="sm"
                          >
                            Previous
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalTransactionPages}
                          </span>
                          <Button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalTransactionPages))} 
                            disabled={currentPage === totalTransactionPages}
                            variant="outline"
                            size="sm"
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">You don't have any transactions yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
