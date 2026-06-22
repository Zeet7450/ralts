import { NextResponse } from "next/server";

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL?.toLowerCase();

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!ALLOWED_EMAIL || normalizedEmail !== ALLOWED_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { error: "This app is private. Access restricted." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
