import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/db";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

// GET: Fetch all markets with pagination
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    
    // Parse pagination parameters
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const category = url.searchParams.get("category");
    
    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }
    
    // Check if the request is from an admin user
    const session = await getServerSession();
    let isAdmin = false;
    
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { isAdmin: true },
      });
      isAdmin = !!user?.isAdmin;
    }
    
    // Regular users are limited to 50 items, admins can request up to 1000
    const maxLimit = isAdmin ? 1000 : 50;
    
    if (isNaN(limit) || limit < 1 || limit > maxLimit) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
    }
    
    // Build query filters
    const filters: any = {};
    if (category) {
      filters.category = category;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Fetch markets with pagination
    const markets = await prisma.market.findMany({
      where: filters,
      include: {
        outcomes: {
          select: {
            id: true,
            title: true,
            probability: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
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
    const totalMarkets = await prisma.market.count({
      where: filters,
    });
    
    const totalPages = Math.ceil(totalMarkets / limit);
    
    return NextResponse.json({
      markets,
      pagination: {
        page,
        limit,
        totalMarkets,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching markets:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching markets" },
      { status: 500 }
    );
  }
}

// POST: Create a new market
export async function POST(req: Request) {
  try {
    // Get the authenticated user
    const session = await getServerSession();
    
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
    
    // Only admins can create markets
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Only administrators can create markets" }, { status: 403 });
    }
    
    // Parse the request body
    const body = await req.json();
    
    // Define validation schema
    const marketSchema = z.object({
      title: z.string().min(5, { message: "Title must be at least 5 characters." }),
      description: z.string().min(10, { message: "Description must be at least 10 characters." }),
      category: z.string().min(1, { message: "Category is required." }),
      endDate: z.string().refine((date: string) => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime()) && parsedDate > new Date();
      }, { message: "End date must be in the future." }),
      rules: z.string().min(20, { message: "Rules must be at least 20 characters." }),
      outcomes: z.array(
        z.object({
          title: z.string().min(1, { message: "Outcome title is required." }),
          description: z.string().optional(),
        })
      ).min(2, { message: "At least 2 outcomes are required." }),
    });
    
    // Validate the request body
    const validationResult = marketSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { title, description, category, endDate, rules, outcomes } = validationResult.data;
    
    // Create the market and outcomes in a transaction
    const market = await prisma.$transaction(async (tx: PrismaClient) => {
      // Create the market
      const newMarket = await tx.market.create({
        data: {
          title,
          description,
          category,
          endDate: new Date(endDate),
          creatorId: user.id,
          volume: 0,
          isResolved: false,
        },
      });
      
      // Create the outcomes
      const initialProbability = 1 / outcomes.length;
      
      for (const outcome of outcomes) {
        await tx.outcome.create({
          data: {
            title: outcome.title,
            description: outcome.description || "",
            marketId: newMarket.id,
            probability: initialProbability,
            isResolved: false,
          },
        });
      }
      
      return newMarket;
    });
    
    // Return the created market
    return NextResponse.json({
      success: true,
      market: {
        id: market.id,
        title: market.title,
        description: market.description,
        category: market.category,
        endDate: market.endDate,
      },
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error creating market:", error);
    return NextResponse.json(
      { error: "An error occurred while creating the market" },
      { status: 500 }
    );
  }
}