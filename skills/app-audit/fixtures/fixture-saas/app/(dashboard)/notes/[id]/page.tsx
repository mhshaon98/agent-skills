import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

type Props = { params: { id: string } };

export const dynamic = 'force-dynamic';

export default async function NoteDetailPage({ params }: Props) {
  const host = headers().get('host');
  const proto = process.env.VERCEL ? 'https' : 'http';

  const res = await fetch(`${proto}://${host}/api/notes/${params.id}`, {
    headers: { cookie: headers().get('cookie') ?? '' },
    cache: 'no-store'
  });

  if (!res.ok) notFound();

  const { note, attachments } = await res.json();

  return (
    <article className="note-detail">
      <h1>{note.title}</h1>
      {note.summary ? (
        <aside className="summary">
          <h2>Summary</h2>
          <p>{note.summary}</p>
        </aside>
      ) : null}
      <pre className="note-body">{note.body}</pre>
      {attachments.length > 0 ? (
        <section className="attachments">
          <h2>Attachments</h2>
          <ul>
            {attachments.map((a: { id: string; original_filename: string }) => (
              <li key={a.id}>{a.original_filename}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
