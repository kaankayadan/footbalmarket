"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Define types for our market data
interface Outcome {
  id: string;
  title: string;
  probability: number;
}

interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  volume: number;
  outcomes: Outcome[];
  createdAt: string;
  endDate: string;
}

const categories = [
  "All",
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Champions League",
  "World Cup",
];

export default function Home() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch markets from the API
  useEffect(() => {
    const fetchMarkets = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const categoryParam = selectedCategory !== "All" ? `&category=${selectedCategory}` : "";
        const response = await fetch(`/api/markets?page=${currentPage}&limit=9${categoryParam}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch markets");
        }
        
        const data = await response.json();
        setMarkets(data.markets);
        setTotalPages(data.pagination.totalPages);
      } catch (err) {
        console.error("Error fetching markets:", err);
        setError("Failed to load markets. Please try again later.");
        toast({
          title: "Error",
          description: "Failed to load markets. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMarkets();
  }, [selectedCategory, currentPage, toast]);

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when changing category
  };

  // Handle pagination
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Football Prediction Market</h1>
        <p className="text-lg text-muted-foreground">
          Trade on football outcomes using virtual coins. Buy and sell your predictions!
        </p>
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="ending">Ending Soon</TabsTrigger>
        </TabsList>

        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => handleCategoryChange(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <TabsContent value="trending" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, index) => (
                <Card key={index} className="h-full">
                  <CardHeader>
                    <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse mt-2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <Button 
                onClick={() => setCurrentPage(1)} 
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No markets found for this category.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {markets.map((market) => (
                  <Link key={market.id} href={`/markets/${market.id}`}>
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{market.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {market.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {market.outcomes.slice(0, 3).map((outcome) => (
                            <div key={outcome.id} className="flex justify-between items-center">
                              <span className="font-medium">{outcome.title}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{Math.round(Number(outcome.probability) * 100)}%</span>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                    Buy Yes
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                    Buy No
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {market.outcomes.length > 3 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              +{market.outcomes.length - 3} more outcomes
                            </div>
                          )}
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                          Volume: {formatVolume(Number(market.volume))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button 
                    onClick={handlePrevPage} 
                    disabled={currentPage === 1}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button 
                    onClick={handleNextPage} 
                    disabled={currentPage === totalPages}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="h-full flex items-center justify-center p-8">
              <p className="text-muted-foreground">Popular markets coming soon</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="h-full flex items-center justify-center p-8">
              <p className="text-muted-foreground">New markets coming soon</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="h-full flex items-center justify-center p-8">
              <p className="text-muted-foreground">Ending soon markets coming soon</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
