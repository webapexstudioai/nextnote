interface PageProps {
  searchParams: { error?: string };
}

export default function UnsubscribedPage({ searchParams }: PageProps) {
  const failed = !!searchParams.error;

  return (
    <main className="min-h-screen bg-[#050507] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md rounded-2xl border border-neutral-900 bg-[#101018] p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
          {failed ? "Something went wrong" : "You're unsubscribed"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          {failed
            ? "We couldn't process your unsubscribe request. Reply to any NextNote email and we'll take you off the list manually."
            : "You won't get any more getting-started reminders from us. If you change your mind, you can always sign back in and pick up your account."}
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-md bg-[#e8553d] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d94a32] transition-colors"
        >
          Back to nextnote.to
        </a>
      </div>
    </main>
  );
}
