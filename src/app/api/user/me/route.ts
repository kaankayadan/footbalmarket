import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: Fetch the current user's data
export async function GET(req: Request) {
  try {
    const session = await import("next-auth").then(mod => mod.getServerSession());

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        balance: true,
        createdAt: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching user data" },
      { status: 500 }
    );
  }
}