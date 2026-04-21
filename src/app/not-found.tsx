import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f", color: "#f5f5f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ display: "inline-block", width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#e8553d,#ff8a6a)", lineHeight: "48px", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>N</div>
        <h1 style={{ fontSize: 48, marginBottom: 8, fontWeight: 700 }}>404</h1>
        <p style={{ color: "#a0a0a0", marginBottom: 24 }}>
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{ padding: "10px 20px", background: "#e8553d", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
