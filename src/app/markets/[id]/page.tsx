"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

// Define types for our market data
interface Outcome {
  id: string;
  title: string;
  probability: number;
  description?: string;
}

interface Trade {
  id: string;
  amount: number;
  price: number;
  type: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  outcome: {
    id: string;
    title: string;
  };
}

interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  volume: number;
  endDate: string;
  createdAt: string;
  isResolved: boolean;
  outcomes: Outcome[];
  rules: string;
  trades: Trade[];
  creator: {
    id: string;
    name: string;
  };
}

export default function MarketPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const { toast } = useToast();

  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [positionType, setPositionType] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<string>("10");
  const [shares, setShares] = useState<string>("");
  const [isTrading, setIsTrading] = useState(false);
  const [userHoldings, setUserHoldings] = useState<any[]>([]);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false);
  const [isSellSharesMode, setIsSellSharesMode] = useState<boolean>(false);

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      
      try {
        const response = await fetch(`/api/markets/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Market not found");
          }
          throw new Error("Failed to fetch market");
        }
        
        const data = await response.json();
        setMarket(data.market);
      } catch (err) {
        console.error("Error fetching market:", err);
        setErrorMsg(err instanceof Error ? err.message : "Failed to load market");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchMarket();
      if (session?.user) {
        fetchUserHoldings();
      }
    }
  }, [id, session]);

  // Fetch user's holdings for this market
  const fetchUserHoldings = async () => {
    if (!session?.user) return;
    
    setIsLoadingHoldings(true);
    try {
      const response = await fetch('/api/user/holdings');
      if (!response.ok) {
        throw new Error("Failed to fetch holdings");
      }
      
      const data = await response.json();
      setUserHoldings(data.holdings);
    } catch (err) {
      console.error("Error fetching holdings:", err);
    } finally {
      setIsLoadingHoldings(false);
    }
  };

  // Get user's holding for specific outcome
  const getUserHoldingForOutcome = (outcomeId: string, posType: "YES" | "NO"): number => {
    if (!userHoldings || userHoldings.length === 0) return 0;
    
    // Find the market in user holdings
    const marketHolding = userHoldings.find((m: any) => m.marketId === id);
    if (!marketHolding || !marketHolding.holdings) return 0;
    
    // Define type for holding items
    interface UserHolding {
      outcomeId: string;
      positionType: "YES" | "NO";
      quantity: number;
    }
    
    // Find the specific outcome holding
    const holding = marketHolding.holdings.find((h: UserHolding) =>
      h.outcomeId === outcomeId && h.positionType === posType
    );
    
    return holding ? holding.quantity : 0;
  };

  // Format date to a more readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format volume to display in a readable format
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    } else {
      return `$${volume}`;
    }
  };

  const handleTrade = async () => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to trade on this market",
        variant: "destructive",
      });
      return;
    }

    if (!selectedOutcome) {
      toast({
        title: "Selection required",
        description: "Please select an outcome to trade",
        variant: "destructive",
      });
      return;
    }

    // For SELL operations, validate the shares field instead of amount
    if (tradeType === "SELL") {
      if (!shares || parseFloat(shares) <= 0) {
        toast({
          title: "Invalid shares amount",
          description: "Please enter a valid number of shares to sell",
          variant: "destructive",
        });
        return;
      }
    } else {
      // For BUY operations, validate the amount
      if (!amount || parseFloat(amount) <= 0) {
        toast({
          title: "Invalid amount",
          description: "Please enter a valid amount",
          variant: "destructive",
        });
        return;
      }
    }

    // Use the entered amount for trades
    let tradeAmount = parseFloat(amount);
    
    // For sell trades, we'll use the shares field if provided
    if (tradeType === "SELL" && shares && selectedOutcome) {
      const sharesToSell = parseFloat(shares);
      const outcomeProb = positionType === "YES"
        ? Number(market?.outcomes.find(o => o.id === selectedOutcome)?.probability)
        : (1 - Number(market?.outcomes.find(o => o.id === selectedOutcome)?.probability));
      
      // Use the actual amount calculated from shares
      tradeAmount = sharesToSell * outcomeProb;
    }

    try {
      setIsTrading(true);

      // Execute the trade via API
      // In Polymarket-style mechanism:
      // - "Buy Yes" at price P = normal BUY at price P
      // - "Buy No" at price (1-P) = SELL at price P (of the same outcome)
      // - "Sell Yes" at price P = normal SELL at price P
      // - "Sell No" at price (1-P) = BUY at price P (of the same outcome)
      
      // Determine the actual trade type based on position type early to use in our checks
      const actualTradeType = positionType === "NO"
        ? (tradeType === "BUY" ? "SELL" : "BUY")
        : tradeType;
      
      // First, check if user has enough shares when selling
      // Need to check in two cases:
      // 1. When explicitly selling YES shares (SELL + YES)
      // 2. When buying NO shares (BUY + NO) which is effectively selling YES shares
      if (actualTradeType === "SELL") {
        // First check if we already have user holdings loaded
        if (!isLoadingHoldings && userHoldings.length > 0) {
          // Use the holdings we already have
          const sharesToSell = parseFloat(shares);
          const availableShares = getUserHoldingForOutcome(selectedOutcome, positionType);
          
          if (sharesToSell > availableShares) {
            toast({
              title: "Insufficient shares",
              description: `You only have ${availableShares.toFixed(6)} shares available to sell`,
              variant: "destructive",
            });
            setIsTrading(false);
            return;
          }
        } else {
          // If we don't have holdings data yet, fetch it
          const holdingsResponse = await fetch("/api/user/holdings");
          if (!holdingsResponse.ok) {
            toast({
              title: "Error checking holdings",
              description: "There was an error checking your holdings",
              variant: "destructive",
            });
            setIsTrading(false);
            return;
          }
          
          const holdingsData = await holdingsResponse.json();
          console.log("Holdings data:", holdingsData);
          
          // Find the relevant holding based on the outcome ID
          // The holdings data is nested - first by market, then by individual outcomes
          let relevantHolding = null;
          if (holdingsData && holdingsData.holdings && Array.isArray(holdingsData.holdings)) {
            // Iterate through each market's holdings
            for (const marketHolding of holdingsData.holdings) {
              // Check individual holdings in this market
              if (marketHolding.holdings && Array.isArray(marketHolding.holdings)) {
                for (const holding of marketHolding.holdings) {
                  if (holding && holding.outcomeId === selectedOutcome && holding.positionType === positionType) {
                    relevantHolding = holding;
                    break;
                  }
                }
              }
              if (relevantHolding) break;
            }
          }
          
          console.log("Found relevant holding:", relevantHolding);
          const sharesToSell = parseFloat(shares);
          if (!relevantHolding || relevantHolding.quantity < sharesToSell) {
            toast({
              title: "Insufficient shares",
              description: `You only have ${relevantHolding ? relevantHolding.quantity.toFixed(6) : 0} shares available to sell`,
              variant: "destructive",
            });
            setIsTrading(false);
            return;
          }
        }
      }
      // Actual trade type already determined above
      
      
      // Looking at the API validation, it expects amount to be a positive number and doesn't
      // have a separate "shares" field. Instead, it has an "isSharesMode" flag.
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: id,
          outcomeId: selectedOutcome,
          amount: tradeType === "BUY" ? tradeAmount : parseFloat(shares), // Use shares as amount for SELL
          type: actualTradeType,
          isSharesMode: tradeType === "SELL" // Set isSharesMode flag for SELL operations
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to execute trade");
      }

      const data = await response.json();
      
      toast({
        title: "Trade executed!",
        description: `Successfully ${tradeType} ${positionType} ${tradeType === "SELL" ? shares : amount} ${tradeType === "SELL" ? "shares" : "coins"} on ${market?.outcomes.find(o => o.id === selectedOutcome)?.title}`,
      });

      // Refresh market data to show updated probabilities
      const marketResponse = await fetch(`/api/markets/${id}`);
      const marketData = await marketResponse.json();
      setMarket(marketData.market);

      // Refresh user holdings
      fetchUserHoldings();
      
    } catch (error) {
      console.error("Trade error:", error);
      toast({
        title: "Trade failed",
        description: error instanceof Error ? error.message : "There was an error executing your trade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
          <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
          <div className="flex items-center gap-4 mt-2">
            <div className="h-6 w-24 bg-gray-200 rounded"></div>
            <div className="h-6 w-24 bg-gray-200 rounded"></div>
            <div className="h-6 w-24 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="h-6 w-32 bg-gray-200 rounded"></div>
                <div className="h-4 w-48 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="h-5 w-32 bg-gray-200 rounded"></div>
                          <div className="h-4 w-24 bg-gray-200 rounded mt-1"></div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-20 bg-gray-200 rounded"></div>
                          <div className="h-8 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-6 w-32 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 w-full bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (errorMsg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {errorMsg === "Market not found" ? "Market not found" : "Error loading market"}
          </h1>
          <p className="mb-6">
            {errorMsg === "Market not found" 
              ? "The market you're looking for doesn't exist or has been removed." 
              : "There was an error loading this market. Please try again later."}
          </p>
          <Link href="/">
            <Button>Go back to homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  // No market data
  if (!market) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Market not found</h1>
          <p className="mb-6">The market you're looking for doesn't exist or has been removed.</p>
          <Link href="/">
            <Button>Go back to homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to markets
        </Link>
        <h1 className="text-3xl font-bold">{market.title}</h1>
        <p className="text-lg text-muted-foreground">{market.description}</p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {market.category}
          </span>
          <span className="text-sm text-muted-foreground">
            Volume: {formatVolume(Number(market.volume))}
          </span>
          <span className="text-sm text-muted-foreground">
            Ends: {formatDate(market.endDate)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          Created by: {market.creator.name}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trading</CardTitle>
              <CardDescription>
                Select an outcome and place your trade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2 px-4 py-2 text-sm text-gray-500">
                  <div>OUTCOME</div>
                  <div className="flex gap-8">
                    <div className="w-20 text-center">% CHANCE</div>
                    <div className="flex gap-4">
                      <div className="w-24 text-center">YES</div>
                      <div className="w-24 text-center">NO</div>
                    </div>
                  </div>
                </div>
                
                {market.outcomes.map((outcome) => (
                  <div
                    key={outcome.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedOutcome === outcome.id
                        ? "border-blue-500 bg-blue-50"
                        : "hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedOutcome(outcome.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <h3 className="font-medium">{outcome.title}</h3>
                      </div>
                      
                      <div className="flex items-center gap-8">
                        <div className="w-20 text-center text-xl font-bold">
                          {Math.round(Number(outcome.probability) * 100)}%
                        </div>
                        
                        <div className="flex gap-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOutcome(outcome.id);
                              setPositionType("YES");
                            }}
                            className={`w-24 ${
                              selectedOutcome === outcome.id
                                ? positionType === "YES"
                                  ? tradeType === "BUY"
                                    ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-300 ring-2 ring-green-500"
                                    : "bg-red-100 hover:bg-red-200 text-red-800 border-red-300 ring-2 ring-red-500"
                                  : ""
                                : "bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                            }`}
                          >
                            {selectedOutcome === outcome.id
                              ? `${tradeType} ${(Number(outcome.probability) * 100).toFixed(1)}¢`
                              : `BUY ${(Number(outcome.probability) * 100).toFixed(1)}¢`}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOutcome(outcome.id);
                              setPositionType("NO");
                            }}
                            className={`w-24 ${
                              selectedOutcome === outcome.id
                                ? positionType === "NO"
                                  ? tradeType === "BUY"
                                    ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-300 ring-2 ring-green-500"
                                    : "bg-red-100 hover:bg-red-200 text-red-800 border-red-300 ring-2 ring-red-500"
                                  : ""
                                : "bg-red-100 hover:bg-red-200 text-red-800 border-red-300"
                            }`}
                          >
                            {selectedOutcome === outcome.id
                              ? `${tradeType} ${(100 - Number(outcome.probability) * 100).toFixed(1)}¢`
                              : `BUY ${(100 - Number(outcome.probability) * 100).toFixed(1)}¢`}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedOutcome && (
                  <div className="mt-8 space-y-4 border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-medium">{market.outcomes.find(o => o.id === selectedOutcome)?.title}</h3>
                        <p className="text-sm text-gray-500">
                          Position: {positionType}
                        </p>
                      </div>
                      <div className="flex items-center rounded-md bg-gray-100 p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`rounded-md px-4 ${tradeType === "BUY" ? "bg-white shadow-sm" : ""}`}
                          onClick={() => setTradeType("BUY")}
                        >
                          Buy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`rounded-md px-4 ${tradeType === "SELL" ? "bg-white shadow-sm" : ""}`}
                          onClick={() => setTradeType("SELL")}
                        >
                          Sell
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label htmlFor="amount">
                            {tradeType === "BUY" ? "Amount (in $)" : "Amount (in $)"}
                          </Label>
                          <span className="text-sm text-gray-500">
                            Price: {positionType === "YES"
                              ? (Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability) * 100).toFixed(1)
                              : (100 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability) * 100).toFixed(1)}¢
                          </span>
                        </div>
                        <Input
                          id="amount"
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            const newAmount = e.target.value;
                            setAmount(newAmount);
                            
                            // Calculate shares when amount changes (only in SELL mode)
                            if (tradeType === "SELL" && selectedOutcome && newAmount) {
                              const outcomeProb = positionType === "YES"
                                ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0)
                                : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0));
                              
                              // Avoid division by zero
                              if (outcomeProb > 0) {
                                const calculatedShares = (parseFloat(newAmount) / outcomeProb).toFixed(2);
                                setShares(calculatedShares);
                              }
                            }
                          }}
                          min="1"
                          disabled={isTrading}
                          className="mb-2"
                          placeholder="Enter amount in $"
                        />
                        
                        {tradeType === "SELL" && (
                          <>
                            <div className="flex justify-between mb-2 mt-4">
                              <Label htmlFor="shares">Number of Shares</Label>
                            </div>
                            <Input
                              id="shares"
                              type="number"
                              value={shares}
                              onChange={(e) => {
                                const newShares = e.target.value;
                                setShares(newShares);
                                
                                // Calculate amount when shares change
                                if (selectedOutcome && newShares) {
                                  const outcomeProb = positionType === "YES"
                                    ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0)
                                    : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0));
                                  
                                  const calculatedAmount = (parseFloat(newShares) * outcomeProb).toFixed(2);
                                  setAmount(calculatedAmount);
                                }
                              }}
                              min="1"
                              disabled={isTrading}
                              className="mb-2"
                              placeholder="Enter number of shares"
                            />
                          </>
                        )}
                        <div className="flex gap-2 justify-between">
                          {[1, 20, 100, "Max"].map((preset) => (
                            <Button
                              key={preset}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (preset === "Max" && tradeType === "SELL" && selectedOutcome) {
                                  // For "Sell All" functionality: use actual user holdings
                                  const maxShares = getUserHoldingForOutcome(selectedOutcome, positionType);
                                  if (maxShares > 0) {
                                    setShares(maxShares.toString());
                                    
                                    // Calculate corresponding amount
                                    const outcomeProb = positionType === "YES"
                                      ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0)
                                      : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0));
                                    
                                    const calculatedAmount = (maxShares * outcomeProb).toFixed(2);
                                    setAmount(calculatedAmount);
                                    return;
                                  }
                                }
                                
                                // Default behavior for other presets
                                const presetAmount = preset === "Max" ? "100" : preset.toString();
                                setAmount(presetAmount);
                                
                                // Update shares accordingly
                                if (tradeType === "SELL" && selectedOutcome) {
                                  const outcomeProb = positionType === "YES"
                                    ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0)
                                    : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability || 0));
                                  
                                  if (outcomeProb > 0) {
                                    const calculatedShares = (parseFloat(presetAmount) / outcomeProb).toFixed(2);
                                    setShares(calculatedShares);
                                  }
                                }
                              }}
                              className="flex-1"
                            >
                              {preset === "Max" && tradeType === "SELL" ? "Sell All" : preset === "Max" ? preset : `$${preset}`}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          {tradeType === "BUY" && selectedOutcome && 
                            `This will purchase approximately ${(parseFloat(amount) / 
                              (positionType === "YES" 
                                ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability) 
                                : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability)))).toFixed(2)} shares`
                          }
                          {tradeType === "SELL" && selectedOutcome &&
                            `This will sell ${shares} shares for approximately $${(parseFloat(shares || "0") *
                              (positionType === "YES"
                                ? Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability)
                                : (1 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability)))).toFixed(2)}`
                          }
                        </p>
                      </div>
                      
                      {session ? (
                        <Button
                          className={`w-full ${tradeType === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                          onClick={handleTrade}
                          disabled={isTrading}
                        >
                          {isTrading
                            ? "Processing..."
                            : `${tradeType} ${positionType} @ ${
                                positionType === "YES"
                                  ? (Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability) * 100).toFixed(1)
                                  : (100 - Number(market.outcomes.find(o => o.id === selectedOutcome)?.probability) * 100).toFixed(1)
                              }¢ ${tradeType === "SELL" ? `(${shares} shares)` : ''}`}
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.location.href = '/login'}
                        >
                          Login to Trade
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{market.rules}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {market.trades && market.trades.length > 0 ? (
                <div className="space-y-3">
                  {market.trades.map((trade) => (
                    <div key={trade.id} className="border-b pb-2 last:border-0">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{trade.user.name}</span>
                        <span className={`text-sm font-medium ${trade.type === "BUY" ? "text-green-600" : "text-red-600"}`}>
                          {trade.type === "BUY" ? "Bought" : "Sold"} {trade.amount} coins
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(trade.createdAt).toLocaleString()} • {trade.outcome.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trading activity yet on this market.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
