import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

// POST: Deposit funds to user's account
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
    const depositSchema = z.object({
      amount: z.number()
        .positive({ message: "Amount must be positive." })
        .min(10, { message: "Minimum deposit amount is 10 coins." })
        .max(10000, { message: "Maximum deposit amount is 10,000 coins." }),
    });

    // Validate the request body
    const validationResult = depositSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { amount } = validationResult.data;

    // Process the deposit in a transaction
    await prisma.$transaction(async (tx: any) => {
      // Update the user's balance
      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // Record the transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          amount,
          type: "DEPOSIT",
        },
      });
    });

    // Get the updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    });

    return NextResponse.json({
      success: true,
      message: `${amount} coins have been added to your account.`,
      balance: updatedUser?.balance,
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your deposit" },
      { status: 500 }
    );
  }
}