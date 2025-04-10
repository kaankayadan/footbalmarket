import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// This is a development-only endpoint to create an admin user
// In a production environment, you would want to secure this endpoint
// or handle admin creation through a more secure process

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update the user to be an admin
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });

    return NextResponse.json({
      success: true,
      message: `User ${email} is now an admin`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        isAdmin: updatedUser.isAdmin,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "An error occurred while creating the admin" },
      { status: 500 }
    );
  }
}