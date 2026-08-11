export default function AccountDeletedPage() {
  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <h1>Account deleted</h1>
      <p style={{ color: "#888", lineHeight: 1.6 }}>
        Your personal data has been permanently removed from SplitFlow. Your expense records remain visible to other group members as "Deleted User."
      </p>
      <p style={{ color: "#888", lineHeight: 1.6 }}>
        A confirmation has been sent to your email address.
      </p>
      <a href="/login" style={{ color: "#2563eb", fontSize: 14 }}>
        Create a new account →
      </a>
    </div>
  );
}