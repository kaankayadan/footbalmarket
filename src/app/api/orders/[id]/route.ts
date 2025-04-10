import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";

// GET: Fetch a specific order by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch the order with its details
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            isResolved: true,
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
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if the user is authorized to view this order
    if (order.userId !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching the order" },
      { status: 500 }
    );
  }
}

// DELETE: Cancel an order
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        market: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if the user is authorized to cancel this order
    if (order.userId !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if the order can be cancelled
    if (order.status !== "OPEN") {
      return NextResponse.json(
        { error: "Only open orders can be cancelled" },
        { status: 400 }
      );
    }

    if (order.market.isResolved) {
      return NextResponse.json(
        { error: "Cannot cancel orders on resolved markets" },
        { status: 400 }
      );
    }

    // Cancel the order and refund if needed
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // Mark the order as cancelled
      const cancelledOrder = await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
        },
      });

      // For BUY orders, refund the reserved balance
      if (order.type === "BUY") {
        const remainingAmount = parseFloat(order.amount.toString()) - parseFloat(order.filled.toString());
        
        if (remainingAmount > 0) {
          // Calculate the refund amount based on the price and remaining quantity
          const refundAmount = remainingAmount;
          
          // Update the user's balance
          await tx.user.update({
            where: { id: user.id },
            data: {
              balance: {
                increment: refundAmount,
              },
            },
          });
          
          // Record the refund transaction
          await tx.transaction.create({
            data: {
              userId: user.id,
              amount: refundAmount,
              type: "ORDER_CANCEL_REFUND",
            },
          });
        }
      }
      
      return cancelledOrder;
    });

    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully",
      order: result,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: "An error occurred while cancelling the order" },
      { status: 500 }
    );
  }
}