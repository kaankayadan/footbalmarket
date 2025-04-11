import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "@/lib/db";

// GET: Fetch user's trade history with pagination
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

    const url = new URL(req.url);
    
    // Parse pagination parameters
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    
    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Fetch trades with pagination
    const trades = await prisma.trade.findMany({
      where: {
        userId: user.id,
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
          },
        },
        outcome: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });
    
    // Get total count for pagination
    const totalTrades = await prisma.trade.count({
      where: {
        userId: user.id,
      },
    });
    
    const totalPages = Math.ceil(totalTrades / limit);
    
    return NextResponse.json({
      trades,
      pagination: {
        page,
        limit,
        totalTrades,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching trades" },
      { status: 500 }
    );
  }
}

// POST: Execute a trade
export async function POST(req: Request) {
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

    // Parse the request body
    const body = await req.json();

    // Define validation schema
    const tradeSchema = z.object({
      marketId: z.string().min(1, { message: "Market ID is required." }),
      outcomeId: z.string().min(1, { message: "Outcome ID is required." }),
      amount: z.number().positive({ message: "Amount must be positive." }),
      type: z.enum(["BUY", "SELL"], {
        errorMap: () => ({ message: "Type must be either BUY or SELL." })
      }),
      positionType: z.enum(["YES", "NO"], { 
        errorMap: () => ({ message: "Position type must be either YES or NO." }) 
      }).optional(),
      isSharesMode: z.boolean().optional(),
    });

    // Validate the request body
    const validationResult = tradeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { marketId, outcomeId, amount, type, positionType = "YES", isSharesMode = false }: {
      marketId: string;
      outcomeId: string;
      amount: number;
      type: "BUY" | "SELL";
      positionType?: "YES" | "NO";
      isSharesMode?: boolean;
    } = validationResult.data;

    // Check if the market exists and is not resolved
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.isResolved) {
      return NextResponse.json(
        { error: "Cannot trade on a resolved market" },
        { status: 400 }
      );
    }

    // Check if the outcome exists and belongs to the market
    const outcome = await prisma.outcome.findFirst({
      where: {
        id: outcomeId,
        marketId,
      },
    });

    if (!outcome) {
      return NextResponse.json(
        { error: "Invalid outcome ID" },
        { status: 400 }
      );
    }

    // Check if the user has enough balance for the trade (only for BUY trades)
    if (type === "BUY" && parseFloat(user.balance.toString()) < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Execute the trade in a transaction
    const trade = await prisma.$transaction(async (tx) => {
      // Declare variables once at function scope
      let userHolding: any = null;
      let profitLoss = 0;
      let sharesToSell = 0;
      let sellAmount = 0;
      
      // For SELL trades, check available shares first
      if (type === "SELL" && positionType === "YES") {
        userHolding = await tx.userOutcome.findFirst({
          where: {
            userId: user.id,
            outcomeId,
          },
        });

        // Get probability to set the correct price for the sell
        const currentOutcome = await tx.outcome.findUnique({
          where: { id: outcomeId },
        });
        
        if (!currentOutcome) {
          throw new Error("Outcome not found");
        }
        
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        
        // Calculate shares to sell based on mode
        if (isSharesMode) {
          // If in shares mode, amount is already the number of shares
          sharesToSell = amount;
          // Calculate dollar value of these shares
          sellAmount = sharesToSell * outcomeProbabilityNum;
        } else {
          // If in dollar mode, convert to shares
          sharesToSell = amount / outcomeProbabilityNum;
          sellAmount = amount;
        }
        
        // Validate the user has enough shares to sell
        if (!userHolding) {
          throw new Error("You don't have any shares to sell for this outcome");
        }
        
        const availableShares = parseFloat(userHolding.quantity.toString());
        if (availableShares <= 0 || availableShares < sharesToSell) {
          throw new Error(`Insufficient shares to sell. You have ${availableShares.toFixed(6)} shares available`);
        }
      } else if (type === "BUY" && positionType === "NO") {
        // Buying NO is treated specially - this doesn't require existing shares
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        
        // When buying NO, we're betting against the outcome
        // The price is (1 - probability) for NO shares
        const noSharePrice = 1 - outcomeProbabilityNum;
        
        if (isSharesMode) {
          // If in shares mode, amount is already the number of shares
          sharesToSell = amount;
          // Calculate dollar value based on NO share price
          sellAmount = sharesToSell * noSharePrice;
        } else {
          // If in dollar mode, convert to shares
          sharesToSell = amount / noSharePrice;
          sellAmount = amount;
        }
        
        // Check if user already has a NO position for this outcome
        userHolding = await tx.userOutcome.findFirst({
          where: {
            userId: user.id,
            outcomeId,
          },
        });
      }

      // Create the trade record
      const newTrade = await tx.trade.create({
        data: {
          userId: user.id,
          marketId,
          outcomeId,
          amount,
          price: outcome.probability,
          type,
        },
      });

      // Handle holdings differently based on trade type and position
      if (type === "BUY" && positionType === "YES") {
        // For BUY YES trades, increase holdings
        // Calculate shares purchased (amount / price)
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        const sharesPurchased = amount / outcomeProbabilityNum;
        
        const existingHolding = await tx.userOutcome.findFirst({
          where: {
            userId: user.id,
            outcomeId,
          },
        });

        if (existingHolding) {
          // Update existing holding with new average price
          const currentQuantity = parseFloat(existingHolding.quantity.toString());
          const currentValue = currentQuantity * parseFloat(existingHolding.avgPrice.toString());
          const newQuantity = currentQuantity + sharesPurchased;
          const newValue = currentValue + amount;
          const newAvgPrice = newValue / newQuantity;

          await tx.userOutcome.update({
            where: { id: existingHolding.id },
            data: {
              quantity: newQuantity,
              avgPrice: newAvgPrice,
            },
          });
        } else {
          // Create new holding
          await tx.userOutcome.create({
            data: {
              userId: user.id,
              outcomeId,
              quantity: sharesPurchased,
              avgPrice: outcome.probability,
            },
          });
        }
      } else if (type === "BUY" && positionType === "NO") {
        // For BUY NO trades, we need to create or update a holding
        // Use the NO share price (1 - probability) as the average price
        // to distinguish it from YES positions in the portfolio
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        const noSharePrice = 1 - outcomeProbabilityNum;
        const sharesPurchased = sharesToSell; // We calculated this already
        
        if (userHolding) {
          // Check if this is indeed a NO position by comparing prices
          const existingAvgPrice = parseFloat(userHolding.avgPrice.toString());
          const isProbablyNo = Math.abs(existingAvgPrice - noSharePrice) <= Math.abs(existingAvgPrice - outcomeProbabilityNum);
          
          if (isProbablyNo) {
            // Update existing NO holding
            const currentQuantity = parseFloat(userHolding.quantity.toString());
            const currentValue = currentQuantity * existingAvgPrice;
            const newQuantity = currentQuantity + sharesPurchased;
            const newValue = currentValue + sellAmount;
            const newAvgPrice = newValue / newQuantity;
            
            await tx.userOutcome.update({
              where: { id: userHolding.id },
              data: {
                quantity: newQuantity,
                avgPrice: newAvgPrice,
              },
            });
          } else {
            // This is a YES holding but we're buying NO, create a new holding with NO price
            await tx.userOutcome.create({
              data: {
                userId: user.id,
                outcomeId,
                quantity: sharesPurchased,
                avgPrice: noSharePrice, // Use NO price to mark as a NO position
              },
            });
          }
        } else {
          // Create new NO holding
          await tx.userOutcome.create({
            data: {
              userId: user.id,
              outcomeId,
              quantity: sharesPurchased,
              avgPrice: noSharePrice, // Use NO price to mark as a NO position
            },
          });
        }
      } else if (type === "SELL" && positionType === "YES") {
        // For SELL YES trades, reduce holdings and calculate profit/loss
        // We're using the values we calculated in the validation section above
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        
        // We've already validated that userHolding exists and has sufficient quantity
        const currentQuantity = parseFloat(userHolding.quantity.toString());
        
        // If selling all shares, delete the record instead of updating it
        if (currentQuantity <= sharesToSell) {
          await tx.userOutcome.delete({
            where: { id: userHolding.id },
          });
        } else {
          // Otherwise just decrement the quantity
          await tx.userOutcome.update({
            where: { id: userHolding.id },
            data: {
              quantity: {
                decrement: sharesToSell,
              },
            },
          });
        }

        // Calculate profit/loss for the transaction using current market price (probability)
        const costBasis = sharesToSell * parseFloat(userHolding.avgPrice.toString());
        profitLoss = sellAmount - costBasis;
      } else if (type === "SELL" && positionType === "NO") {
        // For SELL NO trades, find the user's NO position first
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        const noSharePrice = 1 - outcomeProbabilityNum;
        
        // Find the user's NO position for this outcome
        userHolding = await tx.userOutcome.findFirst({
          where: {
            userId: user.id,
            outcomeId,
          },
        });
        
        if (!userHolding) {
          throw new Error("You don't have any NO shares to sell for this outcome");
        }
        
        // Verify this is indeed a NO position by checking the average price
        const avgPrice = parseFloat(userHolding.avgPrice.toString());
        const isProbablyNo = Math.abs(avgPrice - noSharePrice) <= Math.abs(avgPrice - outcomeProbabilityNum);
        
        if (!isProbablyNo) {
          throw new Error("This appears to be a YES position, not a NO position");
        }
        
        // Calculate shares to sell based on mode
        if (isSharesMode) {
          // If in shares mode, amount is already the number of shares
          sharesToSell = amount;
          // Calculate dollar value based on NO share price
          sellAmount = sharesToSell * noSharePrice;
        } else {
          // If in dollar mode, convert to shares
          sharesToSell = amount / noSharePrice;
          sellAmount = amount;
        }
        
        // Validate the user has enough shares to sell
        const availableShares = parseFloat(userHolding.quantity.toString());
        if (availableShares <= 0 || availableShares < sharesToSell) {
          throw new Error(`Insufficient NO shares to sell. You have ${availableShares.toFixed(6)} shares available`);
        }
        
        // Update the user's holding record to reduce shares
        const currentQuantity = parseFloat(userHolding.quantity.toString());
        
        // If selling all shares, delete the record instead of updating it
        if (currentQuantity <= sharesToSell) {
          await tx.userOutcome.delete({
            where: { id: userHolding.id },
          });
        } else {
          // Otherwise just decrement the quantity
          await tx.userOutcome.update({
            where: { id: userHolding.id },
            data: {
              quantity: {
                decrement: sharesToSell,
              },
            },
          });
        }
        
        // Calculate profit/loss for the transaction
        const costBasis = sharesToSell * avgPrice;
        profitLoss = sellAmount - costBasis;
      }

      // Update the user's balance
      if (type === "BUY" && positionType === "YES") {
        // For BUY YES trades, decrement the balance by the amount
        // Note: amount is already in dollar terms, not shares
        const costOfPurchase = amount;
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              decrement: costOfPurchase,
            },
          },
        });
      } else if (type === "SELL" && positionType === "YES") {
        // For SELL YES trades, increment the balance by the sell amount
        const outcomeProbabilityNum = parseFloat(outcome.probability.toString());
        const sellAmount = isSharesMode ? amount * outcomeProbabilityNum : amount;
        
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              increment: sellAmount,
            },
          },
        });
      } else if (type === "SELL" && positionType === "NO") {
        // For SELL NO trades, increment the balance by the sell amount
        // Note: sellAmount was already calculated during the trade processing
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              increment: sellAmount,
            },
          },
        });
      } else if (type === "BUY" && positionType === "NO") {
        // For BUY NO trades, decrement the balance by the amount
        const costOfPurchase = sellAmount; // Using sellAmount calculated earlier
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              decrement: costOfPurchase,
            },
          },
        });
      }

      // Record the transaction with metadata to store profit/loss info
      // For BUY: negative amount (money spent)
      // For SELL: positive amount (money received)
      let transactionAmount;
      
      if (type === "BUY") {
        transactionAmount = -amount;  // BUY: User spends money
      } else {
        // SELL: User receives money (sellAmount)
        transactionAmount = sellAmount;
      }
      
      const transactionData = {
        userId: user.id,
        amount: transactionAmount,
        type: type === "SELL" ? "TRADE_SELL" : "TRADE_BUY" // Ensure correct transaction type
      };
      
      // Only add metadata for SELL transactions that have profit/loss
      if (type === "SELL" && profitLoss !== 0) {
        // Store profit/loss in metadata as a JSON string
        await tx.transaction.create({
          data: {
            ...transactionData,
            metadata: JSON.stringify({ profitLoss })
          }
        });
      } else {
        // Create transaction without metadata for BUY transactions
        await tx.transaction.create({
          data: transactionData
        });
      }

      // Update the market volume (use the dollar amount, not share quantity)
      await tx.market.update({
        where: { id: marketId },
        data: {
          volume: {
            increment: amount,
          },
        },
      });

      // Enhanced market mechanics - calculate new probability based on trade impact
      const currentProbability = parseFloat(outcome.probability.toString());
      const marketVolume = parseFloat(market.volume.toString());
      const tradeAmount = parseFloat(amount.toString());
      
      // Calculate price impact factor (0.1% per 1% of market volume)
      const volumeRatio = tradeAmount / (marketVolume || 1);
      const impactFactor = 0.001 * volumeRatio * 100; // 0.1% per 1% of volume
      
      let newProbability = currentProbability;
      
      if (type === "BUY") {
        // Buying increases probability with diminishing returns
        const maxIncrease = 1 - currentProbability;
        const effectiveIncrease = impactFactor * maxIncrease;
        newProbability = currentProbability + effectiveIncrease;
      } else if (type === "SELL") {
        // Selling decreases probability with diminishing returns
        const maxDecrease = currentProbability;
        const effectiveDecrease = impactFactor * maxDecrease;
        newProbability = currentProbability - effectiveDecrease;
      }
      
      // Apply bounds (1%-99%)
      newProbability = Math.max(0.01, Math.min(0.99, newProbability));
      
      // Round to 4 decimal places
      newProbability = parseFloat(newProbability.toFixed(4));
      
      // Update all outcomes' probabilities to maintain sum=1
      const allOutcomes = await tx.outcome.findMany({
        where: { marketId },
      });
      
      if (allOutcomes.length > 1) {
        const otherOutcomes = allOutcomes.filter((o: { id: string }) => o.id !== outcomeId);
        const totalOtherProbability = otherOutcomes.reduce(
          (sum: number, o: { probability: Decimal }) => sum + parseFloat(o.probability.toString()),
          0
        );
        
        // Redistribute probabilities while maintaining sum=1
        const scaleFactor = (1 - newProbability) / totalOtherProbability;
        
        await Promise.all(
          otherOutcomes.map(async (outcome: { id: string; probability: Decimal }) => {
            const newOtherProb = parseFloat(outcome.probability.toString()) * scaleFactor;
            await tx.outcome.update({
              where: { id: outcome.id },
              data: {
                probability: parseFloat(newOtherProb.toFixed(4)),
              },
            });
          })
        );
      }

      // Update the traded outcome
      await tx.outcome.update({
        where: { id: outcomeId },
        data: {
          probability: newProbability,
        },
      });

      return newTrade;
    });

    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        amount,
        type,
        marketId,
        outcomeId,
      },
    });
  } catch (error) {
    console.error("Error executing trade:", error);
    return NextResponse.json(
      { error: "An error occurred while executing the trade" },
      { status: 500 }
    );
  }
}