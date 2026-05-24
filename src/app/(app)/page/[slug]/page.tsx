import { notFound } from "next/navigation";
import Link from "next/link";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { getPageBySlug } from "@/lib/payload";

// Renders a standalone editable page authored in the CMS (Pages collection),
// served at /page/<slug>.
export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Back to home
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
          {page.title}
        </h1>
        <div className="prose prose-blue mt-6 max-w-none text-gray-700">
          {page.content ? (
            <RichText
              data={page.content as Parameters<typeof RichText>[0]["data"]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
