import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: Fetch all users (admin only)
export async function GET(req: Request) {
  try {
    const session = await import("next-auth").then(mod => mod.getServerSession());

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the user is an admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse pagination parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    
    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Fetch users with pagination
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        balance: true,
        isAdmin: true,
        _count: {
          select: {
            trades: true,
            transactions: true,
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
    const totalUsers = await prisma.user.count();
    
    const totalPages = Math.ceil(totalUsers / limit);
    
    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching users" },
      { status: 500 }
    );
  }
}