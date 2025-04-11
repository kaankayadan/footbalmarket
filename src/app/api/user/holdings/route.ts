import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

interface Holding {
  id: string;
  outcomeId: string;
  userId: string;
  quantity: Decimal;
  avgPrice: Decimal;
  updatedAt: Date;
  outcome: {
    id: string;
    title: string;
    probability: Decimal;
    marketId: string;
    market: {
      id: string;
      title: string;
      isResolved: boolean;
      resolvedOutcomeId: string | null;
    };
  };
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

// GET: Fetch the current user's holdings with detailed information
export async function GET(req: Request) {
  try {
    const session = await import("next-auth").then(mod => mod.getServerSession());

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all user holdings with related market and outcome data
    const holdings = await prisma.userOutcome.findMany({
      where: {
        userId: user.id,
        quantity: {
          gt: 0, // Only include holdings with positive quantity
        },
      },
      include: {
        outcome: {
          include: {
            market: {
              select: {
                id: true,
                title: true,
                isResolved: true,
                resolvedOutcomeId: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Calculate current value and profit/loss for each holding
    const holdingsWithMetrics = holdings.map((holding: Holding): HoldingWithMetrics => {
      const currentPrice = parseFloat(holding.outcome.probability.toString());
      const avgPrice = parseFloat(holding.avgPrice.toString());
      const quantity = parseFloat(holding.quantity.toString());
      
      // Improved heuristic for position type detection.
      // If a position's average price is closer to the outcome probability than to (1 - probability), it's a YES position.
      // Otherwise, it's a NO position.
      const currentProbability = parseFloat(holding.outcome.probability.toString());
      const isProbablyYes = Math.abs(avgPrice - currentProbability) <= Math.abs(avgPrice - (1 - currentProbability));
      const positionType = isProbablyYes ? "YES" as const : "NO" as const;
      // Calculate value differently based on position type
      let currentValue, costBasis, unrealizedPL, percentChange;
      
      if (positionType === "YES") {
        // For YES positions, use the probability directly
        currentValue = quantity * currentPrice;
        costBasis = quantity * avgPrice;
        unrealizedPL = currentValue - costBasis;
        percentChange = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
      } else {
        // For NO positions, use (1 - probability) as the price
        const noCurrentPrice = 1 - currentPrice;
        // avgPrice is already stored as the NO price (1 - probability at time of purchase)
        currentValue = quantity * noCurrentPrice;
        costBasis = quantity * avgPrice;
        unrealizedPL = currentValue - costBasis;
        percentChange = avgPrice > 0 ? ((noCurrentPrice - avgPrice) / avgPrice) * 100 : 0;
      }
      
      return {
        id: holding.id,
        outcomeId: holding.outcomeId,
        marketId: holding.outcome.marketId,
        marketTitle: holding.outcome.market.title,
        outcomeTitle: holding.outcome.title,
        quantity,
        avgPrice,
        currentPrice,
        currentValue,
        unrealizedPL,
        percentChange,
        isResolved: holding.outcome.market.isResolved,
        isWinner: holding.outcome.market.resolvedOutcomeId === holding.outcomeId,
        positionType,
      };
    });

    // Group holdings by market for better organization
    const holdingsByMarket = holdingsWithMetrics.reduce((acc: Record<string, MarketHoldings>, holding: HoldingWithMetrics) => {
      const marketId = holding.marketId;
      
      if (!acc[marketId]) {
        acc[marketId] = {
          marketId,
          marketTitle: holding.marketTitle,
          isResolved: holding.isResolved,
          holdings: [],
          totalValue: 0,
          totalPL: 0,
        };
      }
      
      acc[marketId].holdings.push(holding);
      acc[marketId].totalValue += holding.currentValue;
      acc[marketId].totalPL += holding.unrealizedPL;
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate portfolio totals
    const portfolioValue = Object.values(holdingsByMarket).reduce(
      (sum: number, market: any) => sum + market.totalValue, 0
    );
    
    const portfolioPL = Object.values(holdingsByMarket).reduce(
      (sum: number, market: any) => sum + market.totalPL, 0
    );

    return NextResponse.json({
      holdings: Object.values(holdingsByMarket),
      portfolioSummary: {
        totalValue: portfolioValue,
        totalPL: portfolioPL,
        plPercentage: portfolioValue > 0 ? (portfolioPL / (portfolioValue - portfolioPL)) * 100 : 0,
      }
    });
  } catch (error) {
    console.error("Error fetching user holdings:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching holdings data" },
      { status: 500 }
    );
  }
}