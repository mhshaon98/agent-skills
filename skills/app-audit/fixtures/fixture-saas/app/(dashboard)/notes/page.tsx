import { redirect } from 'next/navigation';
import NoteCard, { type NoteSummary } from '@/components/NoteCard';
import { getSessionUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('notes')
    .select('id, title, summary, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  const notes = (data ?? []) as NoteSummary[];

  return (
    <section className="notes">
      <h1>My notes</h1>
      {notes.length === 0 ? (
        <p>No notes yet. Start one and we will summarize it for you.</p>
      ) : (
        <div className="note-grid">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </section>
  );
}
