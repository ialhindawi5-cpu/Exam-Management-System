import Link from "next/link";

// Extra links shown in the Payload admin sidebar: a quick way back to the
// custom app dashboard, and an explicit Log out (Payload also has logout in the
// account menu, but this makes it obvious).
export const CmsNavLinks = () => {
  const linkStyle: React.CSSProperties = {
    display: "block",
    padding: "6px 0",
    color: "var(--theme-elevation-700)",
    textDecoration: "none",
    fontSize: 13,
  };
  return (
    <div
      style={{
        marginTop: "1rem",
        paddingTop: "1rem",
        borderTop: "1px solid var(--theme-elevation-150)",
      }}
    >
      <Link href="/admin" style={linkStyle}>
        ← Back to app dashboard
      </Link>
      <Link href="/cms/logout" style={linkStyle} prefetch={false}>
        Log out
      </Link>
    </div>
  );
};
