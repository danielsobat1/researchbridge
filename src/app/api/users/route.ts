// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseKey);
const supabase = hasSupabase ? createClient(supabaseUrl!, supabaseKey!) : null;

const supabaseMissingResponse = NextResponse.json(
  { error: "Supabase is not configured" },
  { status: 503 }
);

export async function POST(req: NextRequest) {
  if (!supabase) return supabaseMissingResponse;
  try {
    const { email, username, firstName, age, university, interests } = await req.json();

    if (!email || !username || !firstName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Create new user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          username,
          firstName,
          age: age || null,
          university: university || null,
          interests: interests || [],
          verified: true,
          createdAt: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!supabase) return supabaseMissingResponse;
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error("User fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!supabase) return supabaseMissingResponse;
  try {
    const { email, firstName, age, university, interests } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        firstName: firstName || undefined,
        age: age || null,
        university: university || null,
        interests: interests || [],
      })
      .eq("email", email)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
