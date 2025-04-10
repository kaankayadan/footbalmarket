import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { Decimal } from "@prisma/client/runtime/library";

// GET: Fetch orders for a market or user
export async function GET(req: Request) {
  try {
    const session = await getServerSession();

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
    const marketId = url.searchParams.get("marketId");
    const outcomeId = url.searchParams.get("outcomeId");
    const userOnly = url.searchParams.get("userOnly") === "true";
    
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
    
    // Build filters based on query parameters
    const filters: any = {
      status: "OPEN", // Only fetch open orders by default
    };
    
    if (marketId) filters.marketId = marketId;
    if (outcomeId) filters.outcomeId = outcomeId;
    if (userOnly) filters.userId = user.id;
    
    // Fetch orders with pagination
    const orders = await prisma.order.findMany({
      where: filters,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
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
            probability: true,
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
    const totalOrders = await prisma.order.count({
      where: filters,
    });
    
    const totalPages = Math.ceil(totalOrders / limit);
    
    // For order book view, group by price level and order type
    const orderBook: {
      bids: Array<{ price: number; volume: number }>;
      asks: Array<{ price: number; volume: number }>;
    } = {
      bids: [], // Buy orders
      asks: [], // Sell orders
    };
    
    if (marketId && outcomeId) {
      // Fetch all open orders for this outcome
      const allOrders = await prisma.order.findMany({
        where: {
          marketId,
          outcomeId,
          status: "OPEN",
        },
        select: {
          type: true,
          price: true,
          amount: true,
          filled: true,
        },
      });
      
      // Group by price and type
      const priceGroupedOrders = allOrders.reduce((acc: any, order: any) => {
        const price = parseFloat(order.price.toString());
        const remainingAmount = parseFloat(order.amount.toString()) - parseFloat(order.filled.toString());
        
        if (remainingAmount <= 0) return acc;
        
        if (!acc[order.type]) acc[order.type] = {};
        if (!acc[order.type][price]) acc[order.type][price] = 0;
        
        acc[order.type][price] += remainingAmount;
        return acc;
      }, { BUY: {}, SELL: {} });
      
      // Convert to arrays and sort
      const bids = Object.entries(priceGroupedOrders.BUY || {}).map(([price, volume]: [string, any]) => ({
        price: parseFloat(price),
        volume,
      })).sort((a, b) => b.price - a.price); // Sort bids high to low
      
      const asks = Object.entries(priceGroupedOrders.SELL || {}).map(([price, volume]: [string, any]) => ({
        price: parseFloat(price),
        volume,
      })).sort((a, b) => a.price - b.price); // Sort asks low to high
      
      orderBook.bids = bids;
      orderBook.asks = asks;
    }
    
    return NextResponse.json({
      orders,
      orderBook,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching orders" },
      { status: 500 }
    );
  }
}

// POST: Create a new order
export async function POST(req: Request) {
  try {
    const session = await getServerSession();

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
    const orderSchema = z.object({
      marketId: z.string().min(1, { message: "Market ID is required." }),
      outcomeId: z.string().min(1, { message: "Outcome ID is required." }),
      type: z.enum(["BUY", "SELL"], { 
        errorMap: () => ({ message: "Type must be either BUY or SELL." }) 
      }),
      orderType: z.enum(["LIMIT", "MARKET"], { 
        errorMap: () => ({ message: "Order type must be either LIMIT or MARKET." }) 
      }),
      amount: z.number().positive({ message: "Amount must be positive." }),
      price: z.number().min(0.01).max(0.99).optional(),
    });

    // Validate the request body
    const validationResult = orderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { marketId, outcomeId, type, orderType, amount, price: inputPrice } = validationResult.data;

    // Check if the market exists and is not resolved
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.isResolved) {
      return NextResponse.json(
        { error: "Cannot place orders on a resolved market" },
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

    // Market orders use the current market price (probability)
    const price = orderType === "MARKET" 
      ? parseFloat(outcome.probability.toString()) 
      : inputPrice;
      
    if (orderType === "LIMIT" && !inputPrice) {
      return NextResponse.json(
        { error: "Price is required for limit orders" },
        { status: 400 }
      );
    }

    // Calculate the maximum cost of this order
    const maxCost = type === "BUY" 
      ? amount 
      : 0; // For sell orders, check available shares instead

    // Check if the user has enough balance for buy orders
    if (type === "BUY" && parseFloat(user.balance.toString()) < maxCost) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // For sell orders, check if the user has enough shares
    if (type === "SELL") {
      const userHolding = await prisma.userOutcome.findFirst({
        where: {
          userId: user.id,
          outcomeId,
        },
      });

      if (!userHolding || parseFloat(userHolding.quantity.toString()) < amount) {
        return NextResponse.json(
          { error: "Insufficient shares to sell" },
          { status: 400 }
        );
      }
    }

    // Create the order and attempt to match
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          userId: user.id,
          marketId,
          outcomeId,
          type,
          orderType,
          amount,
          price: price || 0, // Default to 0 for safety
          status: "OPEN",
        },
      });

      // For market orders, try to match immediately with existing orders
      if (orderType === "MARKET") {
        // Find matching orders on the opposite side
        const matchingOrders = await tx.order.findMany({
          where: {
            marketId,
            outcomeId,
            type: type === "BUY" ? "SELL" : "BUY",
            status: "OPEN",
          },
          orderBy: {
            price: type === "BUY" ? "asc" : "desc",
          },
        });

        let remainingAmount = amount;
        let filledAmount = 0;
        let matchedOrders = [];

        // Process matching orders
        for (const matchingOrder of matchingOrders) {
          if (remainingAmount <= 0) break;

          const availableInMatchingOrder = parseFloat(matchingOrder.amount.toString()) - 
                                          parseFloat(matchingOrder.filled.toString());

          if (availableInMatchingOrder <= 0) continue;

          // Calculate how much to fill
          const fillAmount = Math.min(remainingAmount, availableInMatchingOrder);
          const tradePrice = parseFloat(matchingOrder.price.toString());

          // Update matching order
          await tx.order.update({
            where: { id: matchingOrder.id },
            data: {
              filled: {
                increment: fillAmount,
              },
              status: availableInMatchingOrder <= fillAmount ? "FILLED" : "OPEN",
            },
          });

          // Record the trade
          const trade = await tx.trade.create({
            data: {
              userId: user.id,
              marketId,
              outcomeId,
              amount: fillAmount,
              price: tradePrice,
              type,
            },
          });

          // Record another trade for the counterparty
          await tx.trade.create({
            data: {
              userId: matchingOrder.userId,
              marketId,
              outcomeId,
              amount: fillAmount,
              price: tradePrice,
              type: type === "BUY" ? "SELL" : "BUY",
            },
          });

          // Update holdings for both parties
          if (type === "BUY") {
            // Buyer gets shares
            await updateHoldings(tx, user.id, outcomeId, fillAmount, tradePrice, "BUY");
            // Seller reduces shares
            await updateHoldings(tx, matchingOrder.userId, outcomeId, fillAmount, tradePrice, "SELL");
            
            // Update balances
            const cost = fillAmount * tradePrice;
            await tx.user.update({
              where: { id: user.id },
              data: { balance: { decrement: cost } },
            });
            
            await tx.user.update({
              where: { id: matchingOrder.userId },
              data: { balance: { increment: cost } },
            });
          } else {
            // Seller reduces shares
            await updateHoldings(tx, user.id, outcomeId, fillAmount, tradePrice, "SELL");
            // Buyer gets shares
            await updateHoldings(tx, matchingOrder.userId, outcomeId, fillAmount, tradePrice, "BUY");
            
            // Update balances
            const proceeds = fillAmount * tradePrice;
            await tx.user.update({
              where: { id: user.id },
              data: { balance: { increment: proceeds } },
            });
            
            await tx.user.update({
              where: { id: matchingOrder.userId },
              data: { balance: { decrement: proceeds } },
            });
          }

          // Record transactions
          await recordTransaction(tx, user.id, fillAmount * tradePrice, type === "BUY" ? -1 : 1);
          await recordTransaction(tx, matchingOrder.userId, fillAmount * tradePrice, type === "BUY" ? 1 : -1);

          // Update market volume
          await tx.market.update({
            where: { id: marketId },
            data: {
              volume: {
                increment: fillAmount,
              },
            },
          });

          // Update probabilities based on this trade
          await updateProbabilities(tx, marketId, outcomeId, fillAmount, type);

          remainingAmount -= fillAmount;
          filledAmount += fillAmount;
          matchedOrders.push(matchingOrder.id);
        }

        // Update our order with the filled amount
        await tx.order.update({
          where: { id: order.id },
          data: {
            filled: filledAmount,
            status: filledAmount >= amount ? "FILLED" : "OPEN",
          },
        });

        return {
          order: {
            ...order,
            filled: filledAmount,
            status: filledAmount >= amount ? "FILLED" : "OPEN",
          },
          matchedOrders,
          fullyFilled: filledAmount >= amount,
        };
      }

      // For limit orders, just reserve the funds/shares
      if (type === "BUY") {
        // For buy orders, reserve the funds
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // Record the reservation transaction
        await tx.transaction.create({
          data: {
            userId: user.id,
            amount: -amount,
            type: "ORDER_RESERVE",
          },
        });
      }
      // For sell orders, no need to reserve shares as they're already owned

      return { order, matchedOrders: [], fullyFilled: false };
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      matchedOrders: result.matchedOrders,
      fullyFilled: result.fullyFilled,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "An error occurred while creating the order" },
      { status: 500 }
    );
  }
}

// Helper functions
async function updateHoldings(tx: typeof prisma, userId: string, outcomeId: string, amount: number, price: number, type: string) {
  const existingHolding = await tx.userOutcome.findFirst({
    where: {
      userId,
      outcomeId,
    },
  });

  if (type === "BUY") {
    if (existingHolding) {
      // Update existing holding with new average price
      const currentQuantity = parseFloat(existingHolding.quantity.toString());
      const currentValue = currentQuantity * parseFloat(existingHolding.avgPrice.toString());
      const newValue = currentValue + (amount * price);
      const newQuantity = currentQuantity + amount;
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
          userId,
          outcomeId,
          quantity: amount,
          avgPrice: price,
        },
      });
    }
  } else {
    // For SELL trades, reduce holdings
    await tx.userOutcome.update({
      where: { id: existingHolding.id },
      data: {
        quantity: {
          decrement: amount,
        },
      },
    });
  }
}

async function recordTransaction(tx: typeof prisma, userId: string, amount: number, sign: number) {
  await tx.transaction.create({
    data: {
      userId,
      amount: amount * sign,
      type: "TRADE",
    },
  });
}

async function updateProbabilities(tx: typeof prisma, marketId: string, outcomeId: string, amount: number, type: string) {
  // Get the current outcome and market
  const outcome = await tx.outcome.findUnique({
    where: { id: outcomeId },
  });
  
  const market = await tx.market.findUnique({
    where: { id: marketId },
  });
  
  // Calculate price impact factor (0.1% per 1% of market volume)
  const currentProbability = parseFloat(outcome.probability.toString());
  const marketVolume = parseFloat(market.volume.toString()) || 1;
  const volumeRatio = amount / marketVolume;
  const impactFactor = 0.001 * volumeRatio * 100; // 0.1% per 1% of volume
  
  let newProbability = currentProbability;
  
  if (type === "BUY") {
    // Buying increases probability with diminishing returns
    const maxIncrease = 1 - currentProbability;
    const effectiveIncrease = impactFactor * maxIncrease;
    newProbability = currentProbability + effectiveIncrease;
  } else {
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
}