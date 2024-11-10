import Link from "next/link";

export default function TermsOfService() {
  //open source mit license
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p>
        This is open source software licensed under the MIT license.
      </p>
      <Link href="https://github.com/a1j9o94/visual_audio_book_v2">
        View the source code on GitHub
      </Link>
    </div>
  );
}
