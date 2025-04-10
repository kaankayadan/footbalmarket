import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: Fetch a specific market by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Market ID is required" }, { status: 400 });
    }

    // Fetch the market with its outcomes and creator
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        trades: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            outcome: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    return NextResponse.json({ market });
  } catch (error) {
    console.error("Error fetching market:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching the market" },
      { status: 500 }
    );
  }
}

// PATCH: Update a market (e.g., resolve it)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await import("next-auth").then(mod => mod.getServerSession());

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from the database and check if they are an admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, isAdmin: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch the market
    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        creatorId: true,
        isResolved: true,
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Only admins can resolve markets
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only administrators can resolve markets" },
        { status: 403 }
      );
    }

    // Check if the market is already resolved
    if (market.isResolved) {
      return NextResponse.json(
        { error: "This market is already resolved" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { resolvedOutcomeId } = body;

    if (!resolvedOutcomeId) {
      return NextResponse.json(
        { error: "Resolved outcome ID is required" },
        { status: 400 }
      );
    }

    // Check if the outcome exists and belongs to this market
    const outcome = await prisma.outcome.findFirst({
      where: {
        id: resolvedOutcomeId,
        marketId: id,
      },
    });

    if (!outcome) {
      return NextResponse.json(
        { error: "Invalid outcome ID" },
        { status: 400 }
      );
    }

    // Update the market and outcomes in a transaction
    await prisma.$transaction(async (tx: any) => {
      // Mark the market as resolved with the winning outcome ID
      await tx.market.update({
        where: { id },
        data: {
          isResolved: true,
          resolvedOutcomeId: resolvedOutcomeId
        },
      });

      // Mark the winning outcome as resolved
      await tx.outcome.update({
        where: { id: resolvedOutcomeId },
        data: { isResolved: true },
      });

      // Process payouts based on user holdings rather than trades
      const userHoldings = await tx.userOutcome.findMany({
        where: {
          outcome: {
            marketId: id,
          },
          quantity: {
            gt: 0, // Only include holdings with positive quantity
          },
        },
        include: {
          user: true,
          outcome: true,
        },
      });

      // For each user with holdings in this market
      for (const holding of userHoldings) {
        const quantity = parseFloat(holding.quantity.toString());
        
        if (quantity <= 0) continue;
        
        if (holding.outcomeId === resolvedOutcomeId) {
          // Winner - each share is worth 1 full unit
          await tx.user.update({
            where: { id: holding.userId },
            data: {
              balance: {
                increment: quantity,
              },
            },
          });

          // Record the winning payout transaction
          await tx.transaction.create({
            data: {
              userId: holding.userId,
              amount: quantity,
              type: "MARKET_RESOLUTION_PAYOUT",
            },
          });
        }
        
        // Clear the holdings for all outcomes in this market
        await tx.userOutcome.update({
          where: { id: holding.id },
          data: {
            quantity: 0,
          },
        });
      }
      
      // Cancel any open orders for this market
      const openOrders = await tx.order.findMany({
        where: {
          marketId: id,
          status: "OPEN",
        },
      });
      
      for (const order of openOrders) {
        if (order.type === "BUY") {
          // Refund the reserved balance for buy orders
          const remainingAmount = parseFloat(order.amount.toString()) - parseFloat(order.filled.toString());
          
          if (remainingAmount > 0) {
            const refundAmount = remainingAmount;
            
            await tx.user.update({
              where: { id: order.userId },
              data: {
                balance: {
                  increment: refundAmount,
                },
              },
            });
            
            // Record the refund transaction
            await tx.transaction.create({
              data: {
                userId: order.userId,
                amount: refundAmount,
                type: "ORDER_REFUND",
              },
            });
          }
        }
        
        // Mark the order as cancelled
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Market resolved successfully",
    });
  } catch (error) {
    console.error("Error resolving market:", error);
    return NextResponse.json(
      { error: "An error occurred while resolving the market" },
      { status: 500 }
    );
  }
}