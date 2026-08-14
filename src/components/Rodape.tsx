import Link from "next/link";

export function Rodape() {
  const ano = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-borda">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="display text-base leading-none">
          Clan<span className="text-destaque">·</span>Maromba
        </p>

        <p className="text-xs leading-relaxed text-texto-apagado">
          © {ano} · Acesso individual e intransferível. O vídeo é marcado com os
          dados de quem assiste.
        </p>

        <Link
          className="text-xs text-texto-apagado transition-colors hover:text-texto-fraco"
          href="/minhas-lives"
        >
          Minhas lives
        </Link>
      </div>
    </footer>
  );
}
