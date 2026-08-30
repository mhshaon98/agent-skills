import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <img src="/logo.svg" alt="Notably" width={112} height={24} />
      </Link>
      <div className="nav-links">
        <Link href="/pricing">Pricing</Link>
        <Link href="/notes">My notes</Link>
        <Link href="/account">Account</Link>
      </div>
    </nav>
  );
}
