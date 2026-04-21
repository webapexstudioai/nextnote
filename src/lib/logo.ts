import { supabaseAdmin } from "@/lib/supabase";

type LogoPalette = {
  label: string;
  primary: string;
  accent: string;
  logoConcept: string;
};

async function ensureLogosBucket(): Promise<void> {
  try {
    const { data } = await supabaseAdmin.storage.getBucket("website-logos");
    if (data) return;
  } catch {
    // fall through to create
  }
  try {
    await supabaseAdmin.storage.createBucket("website-logos", { public: true });
  } catch {
    // may already exist — ignore
  }
}

function buildLogoPrompt(palette: LogoPalette, businessName: string): string {
  return [
    `A clean, modern, professional flat vector logo icon for a ${palette.label.toLowerCase()} business called "${businessName}".`,
    `Subject: ${palette.logoConcept}`,
    `Style: flat graphic design, single solid color fill, bold and simple silhouette, centered composition, studio-quality brand mark like those in Dribbble or Behance logo showcases.`,
    `Color: use the color ${palette.accent} as the main fill. Optional secondary detail can use ${palette.primary}.`,
    `Background: pure transparent (no background color, no shape behind the icon, no border, no frame).`,
    `Strict requirements: NO text, NO letters, NO words, NO numbers, NO typography of any kind. NO watermarks, NO logos of other brands, NO photorealism, NO gradients, NO drop shadows, NO 3D effects, NO mascots, NO people, NO faces. Just the icon mark on a transparent background.`,
    `Composition: the icon is centered with comfortable padding around it, no cropping. Symmetrical and balanced. Reads clearly at 24px.`,
    `Output: a clean, minimal, premium brand icon — like a polished iOS app icon without the rounded square container.`,
  ].join("\n");
}

export async function generateBusinessLogo(
  palette: LogoPalette,
  businessName: string,
  siteId: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = buildLogoPrompt(palette, businessName);

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        background: "transparent",
        quality: "medium",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Logo generation failed:", res.status, errText.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const buffer = Buffer.from(b64, "base64");

    await ensureLogosBucket();

    const filePath = `${siteId}.png`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("website-logos")
      .upload(filePath, buffer, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.error("Logo upload failed:", uploadErr.message);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("website-logos")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Logo generation error:", err instanceof Error ? err.message : err);
    return null;
  }
}
