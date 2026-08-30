import Link from 'next/link';

export type NoteSummary = {
  id: string;
  title: string;
  summary: string | null;
  updated_at: string;
};

export default function NoteCard({ note }: { note: NoteSummary }) {
  return (
    <Link href={`/notes/${note.id}`} className="note-card">
      <h3>{note.title}</h3>
      <p>{note.summary ?? 'Not summarized yet'}</p>
      <time dateTime={note.updated_at}>
        {new Date(note.updated_at).toLocaleDateString()}
      </time>
    </Link>
  );
}
