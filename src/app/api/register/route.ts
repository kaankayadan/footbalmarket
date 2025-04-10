import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json();

    // Basic validation
    if (!body.name || body.name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({ error: "Please provide a valid email" }, { status: 400 });
    }

    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const { name, email, password } = body;

    // Check if user already exists
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        balance: 1000,
      },
    });

    // Return success, don't include password
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json({
      error: "An error occurred during registration. Please try again later."
    }, { status: 500 });
  }
}
