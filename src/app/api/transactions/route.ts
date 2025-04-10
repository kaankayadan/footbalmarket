import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

// GET: Fetch user's transaction history with pagination
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
    
    // Fetch transactions with pagination
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });
    
    // Get total count for pagination
    const totalTransactions = await prisma.transaction.count({
      where: {
        userId: user.id,
      },
    });
    
    const totalPages = Math.ceil(totalTransactions / limit);
    
    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        totalTransactions,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching transactions" },
      { status: 500 }
    );
  }
}