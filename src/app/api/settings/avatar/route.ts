import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, WebP, or GIF." }, { status: 400 });
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filePath = `avatars/${session.userId}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      // Try creating the bucket if it doesn't exist
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        await supabaseAdmin.storage.createBucket("avatars", { public: true });
        const { error: retryError } = await supabaseAdmin.storage
          .from("avatars")
          .upload(filePath, buffer, { contentType: file.type, upsert: true });
        if (retryError) {
          console.error("Avatar upload retry error:", retryError);
          return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

    // Save URL to users table
    await supabaseAdmin
      .from("users")
      .update({ profile_image_url: avatarUrl })
      .eq("id", session.userId);

    return NextResponse.json({ url: avatarUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Remove from Supabase Storage (try common extensions)
    for (const ext of ["jpg", "png", "webp", "gif"]) {
      await supabaseAdmin.storage
        .from("avatars")
        .remove([`avatars/${session.userId}.${ext}`]);
    }

    // Clear URL in users table
    await supabaseAdmin
      .from("users")
      .update({ profile_image_url: null })
      .eq("id", session.userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Avatar delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
