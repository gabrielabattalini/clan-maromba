"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import {
  apagarLiveInput,
  criarChaveDeAssinatura,
  criarLiveInput,
} from "@/lib/cloudflare";
import { cloudflareConfigurado } from "@/lib/config";
import { exigirAdmin } from "@/lib/conta";
import { gerarSlug } from "@/lib/formato";
import { ipDoVisitante } from "@/lib/requisicao";
import { buscarPagamentoDaCompra, statusDaCompra } from "@/lib/mercadopago";
import { clienteAdmin } from "@/lib/supabase/admin";
import type {
  ChaveAssinaturaGerada,
  Compra,
  EstadoFormulario,
  EstadoLive,
} from "@/lib/tipos";

/**
 * Lê o campo de data e hora do formulário como horário de BRASÍLIA.
 *
 * O navegador manda "2026-09-26T22:00", sem fuso. Se o servidor
 * interpretasse com o fuso dele (UTC), a janela do ingresso ficaria 3 horas
 * deslocada — e as finais, que já viram a madrugada, cortariam na hora
 * errada. O Brasil não tem mais horário de verão, então o -03:00 é fixo.
 */
function instanteEmBrasilia(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const data = new Date(`${limpo}:00-03:00`);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/** "19,90" ou "19.90" ou "19" → 1990 centavos. */
function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

export async function criarLive(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();

  const titulo = String(dados.get("titulo") ?? "").trim();
  const descricao = String(dados.get("descricao") ?? "").trim();
  const precoTexto = String(dados.get("preco") ?? "").trim();

  // Os três campos de data são opcionais: dá para anunciar e vender uma live
  // sem saber ainda quando ela vai ser.
  const diaInicio = String(dados.get("dia_inicio") ?? "").trim() || null;
  const diaFim = String(dados.get("dia_fim") ?? "").trim() || null;
  const hora = String(dados.get("hora") ?? "").trim() || null;

  if (titulo.length < 3) return { erro: "Dê um título para a live." };

  if (diaFim && !diaInicio) {
    return { erro: "Preencha o primeiro dia antes de informar o último." };
  }
  if (diaInicio && diaFim && diaFim < diaInicio) {
    return { erro: "O último dia não pode ser antes do primeiro." };
  }

  const precoCentavos = centavosDeTexto(precoTexto);
  if (precoCentavos === null) return { erro: "Preço inválido. Exemplo: 19,90" };

  const supabase = clienteAdmin();

  // Slug único (o endereço da página da live).
  const base = gerarSlug(titulo) || "live";
  let slug = base;
  for (let tentativa = 2; tentativa <= 50; tentativa++) {
    const { data: existente } = await supabase
      .from("lives")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existente) break;
    slug = `${base}-${tentativa}`;
  }

  const { data: live, error } = await supabase
    .from("lives")
    .insert({
      slug,
      titulo,
      descricao,
      dia_inicio: diaInicio,
      dia_fim: diaFim,
      hora,
      preco_centavos: precoCentavos,
      estado: "rascunho",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !live) {
    return { erro: "Não consegui salvar a live. Tente de novo." };
  }

  // Toda live nasce com um ingresso: sem isso não há o que comprar.
  await supabase.from("ingressos").insert({
    live_id: live.id,
    nome: "Acesso à live",
    descricao: "",
    preco_centavos: precoCentavos,
    ordem: 0,
  });

  // Cria o canal de transmissão na Cloudflare (URL + chave do OBS).
  if (cloudflareConfigurado) {
    try {
      const input = await criarLiveInput(titulo);
      await supabase.from("lives_privado").upsert({
        live_id: live.id,
        cf_input_uid: input.uid,
        cf_rtmps_url: input.rtmpsUrl,
        cf_stream_key: input.streamKey,
        atualizado_em: new Date().toISOString(),
      });
    } catch (erro) {
      console.error("[admin] falha ao criar live input:", erro);
      // A live fica salva mesmo assim; o painel avisa e oferece tentar de novo.
    }
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: live.id,
    acao: "admin_criou_live",
    ip: await ipDoVisitante(),
    detalhes: { titulo, precoCentavos },
  });

  revalidatePath("/admin");
  redirect(`/admin/live/${live.id}`);
}

export async function mudarEstadoDaLive(liveId: string, dados: FormData): Promise<void> {
  const conta = await exigirAdmin();
  const estado = String(dados.get("estado") ?? "") as EstadoLive;

  // O painel só troca entre estes dois. "No ar" é detectado pela Cloudflare, e
  // "encerrada" é ajustado direto no banco quando o dono quiser tirar de venda.
  const permitidos: EstadoLive[] = ["rascunho", "anunciada"];
  if (!permitidos.includes(estado)) return;

  await clienteAdmin().from("lives").update({ estado }).eq("id", liveId);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: "admin_mudou_estado_da_live",
    ip: await ipDoVisitante(),
    detalhes: { estado },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
}

export async function criarCanalDeTransmissao(liveId: string): Promise<void> {
  const conta = await exigirAdmin();
  if (!cloudflareConfigurado) return;

  const supabase = clienteAdmin();
  const { data: live } = await supabase
    .from("lives")
    .select("titulo")
    .eq("id", liveId)
    .maybeSingle<{ titulo: string }>();

  if (!live) return;

  try {
    const input = await criarLiveInput(live.titulo);
    await supabase.from("lives_privado").upsert({
      live_id: liveId,
      cf_input_uid: input.uid,
      cf_rtmps_url: input.rtmpsUrl,
      cf_stream_key: input.streamKey,
      atualizado_em: new Date().toISOString(),
    });

    await registrar({
      usuarioId: conta.usuarioId,
      liveId,
      acao: "admin_criou_canal_transmissao",
      ip: await ipDoVisitante(),
    });
  } catch (erro) {
    console.error("[admin] falha ao criar canal:", erro);
  }

  revalidatePath(`/admin/live/${liveId}`);
}

/**
 * Cria a chave que assina os tokens de reprodução.
 *
 * A Cloudflare mostra o segredo UMA única vez. Por isso devolvemos o valor
 * para a tela do painel: o dono copia e cola na Vercel na mesma hora.
 * O segredo não é gravado no nosso banco.
 */
export async function gerarChaveDeAssinatura(): Promise<ChaveAssinaturaGerada> {
  const conta = await exigirAdmin();

  if (!cloudflareConfigurado) {
    return { erro: "Configure primeiro o Cloudflare Stream (Passo 4 da Fase 0)." };
  }

  try {
    const chave = await criarChaveDeAssinatura();

    await registrar({
      usuarioId: conta.usuarioId,
      acao: "admin_gerou_chave_de_assinatura",
      ip: await ipDoVisitante(),
      detalhes: { chaveId: chave.id },
    });

    return { id: chave.id, jwk: chave.jwk };
  } catch (erro) {
    console.error("[admin] falha ao gerar chave de assinatura:", erro);
    return {
      erro: "A Cloudflare recusou o pedido. Confira se o token tem permissão de Stream: Edit.",
    };
  }
}

/**
 * Apaga uma live de vez.
 *
 * Recusa quando existe compra paga: o registro de quem pagou tem de
 * sobreviver, mesmo que a live não aconteça mais. Para tirar de venda uma
 * live já vendida, o caminho é marcar `encerrada` no banco.
 */
export async function apagarLive(liveId: string): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: live } = await supabase
    .from("lives")
    .select("titulo")
    .eq("id", liveId)
    .maybeSingle<{ titulo: string }>();

  if (!live) return { erro: "Live não encontrada." };

  const { count } = await supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("live_id", liveId)
    .in("status", ["aprovada", "reembolsada"]);

  const pagas = count ?? 0;
  if (pagas > 0) {
    return {
      erro:
        `Esta live tem ${pagas} compra${pagas > 1 ? "s" : ""} paga${pagas > 1 ? "s" : ""} ` +
        "e não pode ser apagada — o registro de quem pagou precisa ser guardado. " +
        "Para tirar de venda, marque o estado como \"encerrada\" no Supabase.",
    };
  }

  // Some também com o canal na Cloudflare, senão fica um input órfão lá.
  const { data: privado } = await supabase
    .from("lives_privado")
    .select("cf_input_uid")
    .eq("live_id", liveId)
    .maybeSingle<{ cf_input_uid: string | null }>();

  if (privado?.cf_input_uid && cloudflareConfigurado) {
    try {
      await apagarLiveInput(privado.cf_input_uid);
    } catch (erro) {
      console.error("[admin] falha ao apagar o canal na Cloudflare:", erro);
      // Seguimos assim mesmo: o canal órfão não atrapalha o site.
    }
  }

  const { error } = await supabase.from("lives").delete().eq("id", liveId);
  if (error) {
    console.error("[admin] falha ao apagar a live:", error.message);
    return { erro: "Não consegui apagar a live. Tente de novo." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    acao: "admin_apagou_live",
    ip: await ipDoVisitante(),
    detalhes: { liveId, titulo: live.titulo },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function criarIngresso(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();

  const nome = String(dados.get("nome") ?? "").trim();
  const descricao = String(dados.get("descricao") ?? "").trim();
  if (nome.length < 2) return { erro: "Dê um nome ao ingresso." };

  const preco = centavosDeTexto(String(dados.get("preco") ?? ""));
  if (preco === null) return { erro: "Preço inválido. Exemplo: 9,90" };

  const cheioTexto = String(dados.get("preco_cheio") ?? "").trim();
  const precoCheio = cheioTexto ? centavosDeTexto(cheioTexto) : null;
  if (cheioTexto && precoCheio === null) {
    return { erro: "Preço cheio inválido. Exemplo: 39,90" };
  }
  if (precoCheio !== null && precoCheio <= preco) {
    return { erro: "O preço cheio precisa ser MAIOR que o promocional." };
  }

  const promocaoAte = instanteEmBrasilia(String(dados.get("promocao_ate") ?? ""));
  if (promocaoAte && precoCheio === null) {
    return {
      erro:
        "Para ter contagem regressiva é preciso informar o preço cheio — " +
        "é ele que passa a valer quando o prazo acabar.",
    };
  }

  const iniciaEm = instanteEmBrasilia(String(dados.get("inicia_em") ?? ""));
  const terminaEm = instanteEmBrasilia(String(dados.get("termina_em") ?? ""));
  if (iniciaEm && terminaEm && terminaEm <= iniciaEm) {
    return { erro: "O fim da janela precisa ser depois do começo." };
  }

  const limiteTexto = String(dados.get("limite") ?? "").trim();
  const limite = limiteTexto ? Number(limiteTexto.replace(/\D/g, "")) : null;
  if (limiteTexto && (!limite || limite < 1)) {
    return { erro: "Limite inválido. Deixe em branco para não ter limite." };
  }

  const ordemTexto = String(dados.get("ordem") ?? "").trim();
  const ordem = ordemTexto ? Number(ordemTexto.replace(/\D/g, "")) : 0;

  // Ingresso do bolão não abre o player, então janela nele não significa
  // nada: guardar uma daria a impressão, no painel, de que ele libera vídeo
  // em algum horário.
  const soBolao = dados.get("so_bolao") === "sim";

  const { error } = await clienteAdmin().from("ingressos").insert({
    live_id: liveId,
    nome,
    descricao,
    preco_centavos: preco,
    preco_cheio_centavos: precoCheio,
    promocao_ate: promocaoAte,
    inicia_em: soBolao ? null : iniciaEm,
    termina_em: soBolao ? null : terminaEm,
    limite,
    so_bolao: soBolao,
    ordem: Number.isFinite(ordem) ? ordem : 0,
  });

  if (error) {
    console.error("[admin] falha ao criar ingresso:", error.message);
    return { erro: "Não consegui salvar o ingresso. Tente de novo." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: "admin_criou_ingresso",
    ip: await ipDoVisitante(),
    detalhes: { nome, preco },
  });

  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
  return { aviso: `Ingresso "${nome}" criado.` };
}

export async function alternarIngresso(
  liveId: string,
  ingressoId: string,
  ativar: boolean,
): Promise<void> {
  const conta = await exigirAdmin();

  await clienteAdmin().from("ingressos").update({ ativo: ativar }).eq("id", ingressoId);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: ativar ? "admin_ativou_ingresso" : "admin_desativou_ingresso",
    ip: await ipDoVisitante(),
    detalhes: { ingressoId },
  });

  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
}

export async function derrubarSessao(usuarioId: string): Promise<void> {
  const conta = await exigirAdmin();

  await clienteAdmin().from("sessoes_ativas").delete().eq("usuario_id", usuarioId);

  await registrar({
    usuarioId: conta.usuarioId,
    acao: "admin_derrubou_sessao",
    ip: await ipDoVisitante(),
    detalhes: { alvo: usuarioId },
  });

  revalidatePath("/admin");
}

export async function alternarBanimento(
  usuarioId: string,
  banir: boolean,
): Promise<void> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  await supabase.from("perfis").update({ banido: banir }).eq("id", usuarioId);
  if (banir) {
    await supabase.from("sessoes_ativas").delete().eq("usuario_id", usuarioId);
  }

  await registrar({
    usuarioId: conta.usuarioId,
    acao: banir ? "admin_baniu_usuario" : "admin_desbaniu_usuario",
    ip: await ipDoVisitante(),
    detalhes: { alvo: usuarioId },
  });

  revalidatePath("/admin");
}

// ------------------------------------------------------------
// Bolão
// ------------------------------------------------------------

export async function salvarPremioDoBolao(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const premio = String(dados.get("premio") ?? "").trim().slice(0, 300);

  const { error } = await clienteAdmin()
    .from("lives")
    .update({ bolao_premio: premio })
    .eq("id", liveId);

  if (error) return { erro: "Não consegui salvar o prêmio." };

  revalidatePath(`/admin/live/${liveId}`);
  return { aviso: premio ? "Prêmio salvo." : "Prêmio removido." };
}

export async function criarCategoriaDoBolao(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const nome = String(dados.get("nome") ?? "").trim();
  const fechaEm = instanteEmBrasilia(String(dados.get("fecha_em") ?? ""));
  const ordem = Number(String(dados.get("ordem") ?? "0").trim() || 0);

  if (nome.length < 2) return { erro: "Dê um nome à categoria. Ex.: Men's Open" };
  if (!fechaEm) return { erro: "Diga a hora em que os palpites fecham." };

  const { error } = await clienteAdmin().from("bolao_categorias").insert({
    live_id: liveId,
    nome,
    fecha_em: fechaEm,
    ordem: Number.isFinite(ordem) ? ordem : 0,
  });

  if (error) {
    console.error("[bolao] falha ao criar categoria:", error.message);
    return { erro: "Não consegui criar a categoria." };
  }

  revalidatePath(`/admin/live/${liveId}`);
  return { aviso: `Categoria ${nome} criada.` };
}

export async function apagarCategoriaDoBolao(
  liveId: string,
  categoriaId: string,
): Promise<void> {
  await exigirAdmin();
  const supabase = clienteAdmin();

  // Apagar a categoria levaria os palpites junto (cascade). Enquanto houver
  // gente participando, isso apagaria o jogo dos outros sem aviso.
  const { count } = await supabase
    .from("bolao_palpites")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", categoriaId);

  if ((count ?? 0) > 0) {
    revalidatePath(`/admin/live/${liveId}`);
    return;
  }

  await supabase.from("bolao_categorias").delete().eq("id", categoriaId);
  revalidatePath(`/admin/live/${liveId}`);
}

/**
 * Substitui a lista de atletas de uma categoria por uma lista colada.
 *
 * Depois que existe palpite, atleta que já está na lista não sai mais: ele é
 * referenciado pelos palpites, e sumir com ele apagaria o palpite de quem
 * escolheu aquele nome. Nome novo pode entrar a qualquer momento.
 */
export async function salvarAtletas(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const supabase = clienteAdmin();

  const nomes = String(dados.get("atletas") ?? "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .slice(0, 60);

  if (nomes.length < 5) {
    return { erro: "Precisa de pelo menos 5 atletas — o palpite é um top 5." };
  }
  if (new Set(nomes.map((n) => n.toLowerCase())).size !== nomes.length) {
    return { erro: "Tem nome repetido na lista." };
  }

  const { data: atuais } = await supabase
    .from("bolao_atletas")
    .select("id, nome")
    .eq("categoria_id", categoriaId)
    .returns<{ id: string; nome: string }[]>();

  const { count } = await supabase
    .from("bolao_palpites")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", categoriaId);

  const temPalpite = (count ?? 0) > 0;
  const existentes = new Map((atuais ?? []).map((a) => [a.nome.toLowerCase(), a]));

  const paraRemover = (atuais ?? []).filter(
    (a) => !nomes.some((n) => n.toLowerCase() === a.nome.toLowerCase()),
  );

  if (temPalpite && paraRemover.length > 0) {
    return {
      erro: `Já tem palpite nesta categoria, então não dá para tirar atleta da lista (${paraRemover
        .map((a) => a.nome)
        .join(", ")}). Você ainda pode acrescentar nomes.`,
    };
  }

  if (paraRemover.length > 0) {
    await supabase
      .from("bolao_atletas")
      .delete()
      .in("id", paraRemover.map((a) => a.id));
  }

  // A ordem da lista colada vira a ordem de exibição.
  const novos = nomes
    .map((nome, indice) => ({ nome, indice }))
    .filter(({ nome }) => !existentes.has(nome.toLowerCase()));

  if (novos.length > 0) {
    const { error } = await supabase.from("bolao_atletas").insert(
      novos.map(({ nome, indice }) => ({
        categoria_id: categoriaId,
        nome,
        ordem: indice,
      })),
    );
    if (error) {
      console.error("[bolao] falha ao inserir atletas:", error.message);
      return { erro: "Não consegui salvar a lista." };
    }
  }

  for (const [posicao, nome] of nomes.entries()) {
    const jaExistia = existentes.get(nome.toLowerCase());
    if (jaExistia) {
      await supabase
        .from("bolao_atletas")
        .update({ ordem: posicao })
        .eq("id", jaExistia.id);
    }
  }

  revalidatePath(`/admin/bolao/${categoriaId}`);
  return { aviso: `${nomes.length} atletas na lista.` };
}

/** O prêmio anunciado desta categoria. */
export async function salvarPremioDaCategoria(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const premio = String(dados.get("premio") ?? "").trim().slice(0, 300);

  const { error } = await clienteAdmin()
    .from("bolao_categorias")
    .update({ premio })
    .eq("id", categoriaId);

  if (error) return { erro: "Não consegui salvar o prêmio." };

  revalidatePath(`/admin/bolao/${categoriaId}`);
  return { aviso: premio ? "Prêmio salvo." : "Prêmio removido." };
}

/**
 * Cria o ticket de venda de uma categoria do bolão.
 *
 * Nasce sempre com `so_bolao`: ele não pode abrir o player em hipótese
 * nenhuma. E é um por categoria — quem quer palpitar nas três compra três.
 */
export async function criarTicketDoBolao(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: categoria } = await supabase
    .from("bolao_categorias")
    .select("id, live_id, nome")
    .eq("id", categoriaId)
    .maybeSingle<{ id: string; live_id: string; nome: string }>();

  if (!categoria) return { erro: "Categoria não encontrada." };

  const preco = centavosDeTexto(String(dados.get("preco") ?? ""));
  if (preco === null) return { erro: "Preço inválido. Exemplo: 5,00" };

  const { count } = await supabase
    .from("ingressos")
    .select("id", { count: "exact", head: true })
    .eq("categoria_bolao_id", categoriaId);

  if ((count ?? 0) > 0) {
    return { erro: "Esta categoria já tem ticket. Tire o antigo de venda antes." };
  }

  const { error } = await supabase.from("ingressos").insert({
    live_id: categoria.live_id,
    nome: `Bolão · ${categoria.nome}`,
    descricao: "Dá direito a palpitar nesta categoria. Não abre a transmissão.",
    preco_centavos: preco,
    so_bolao: true,
    categoria_bolao_id: categoria.id,
    ordem: 90,
  });

  if (error) {
    console.error("[bolao] falha ao criar ticket:", error.message);
    return { erro: "Não consegui criar o ticket." };
  }

  revalidatePath(`/admin/bolao/${categoriaId}`);
  return { aviso: "Ticket criado." };
}

/** Publica o top 5 oficial. É o que faz o ranking existir. */
export async function definirResultado(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const posicoes = ["atleta_1", "atleta_2", "atleta_3", "atleta_4", "atleta_5"].map(
    (campo) => String(dados.get(campo) ?? "").trim(),
  );

  if (posicoes.some((id) => !id)) {
    return { erro: "Preencha as cinco posições." };
  }
  if (new Set(posicoes).size !== posicoes.length) {
    return { erro: "Não repita o mesmo atleta em duas posições." };
  }

  const { data: atletas } = await supabase
    .from("bolao_atletas")
    .select("id")
    .eq("categoria_id", categoriaId)
    .returns<{ id: string }[]>();

  const daCategoria = new Set((atletas ?? []).map((a) => a.id));
  if (posicoes.some((id) => !daCategoria.has(id))) {
    return { erro: "Atleta de outra categoria. Recarregue a página." };
  }

  const { error } = await supabase.from("bolao_resultados").upsert(
    {
      categoria_id: categoriaId,
      atleta_1: posicoes[0],
      atleta_2: posicoes[1],
      atleta_3: posicoes[2],
      atleta_4: posicoes[3],
      atleta_5: posicoes[4],
      publicado_em: new Date().toISOString(),
    },
    { onConflict: "categoria_id" },
  );

  if (error) {
    console.error("[bolao] falha ao publicar resultado:", error.message);
    return { erro: "Não consegui publicar o resultado." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    acao: "admin_publicou_resultado",
    ip: await ipDoVisitante(),
    detalhes: { categoria: categoriaId },
  });

  revalidatePath(`/admin/bolao/${categoriaId}`);
  return { aviso: "Resultado publicado. O ranking já está valendo." };
}

/**
 * Fecha ou adia os palpites de uma categoria na mão.
 *
 * O horário automático continua valendo como rede de segurança — se o dono
 * estiver ocupado comentando e esquecer, a categoria fecha sozinha e ninguém
 * palpita sabendo do prejudging. Estes botões são para o dia real: evento
 * atrasou, adia; começou antes, fecha agora.
 *
 * Não existe campo novo: fechar é empurrar `fecha_em` para agora, e adiar é
 * empurrar para a frente. Uma informação só, um lugar só.
 */
export async function ajustarFechamentoDoBolao(
  categoriaId: string,
  minutos: number | "agora",
): Promise<void> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: categoria } = await supabase
    .from("bolao_categorias")
    .select("fecha_em")
    .eq("id", categoriaId)
    .maybeSingle<{ fecha_em: string }>();

  if (!categoria) return;

  const agora = Date.now();
  let novo: Date;

  if (minutos === "agora") {
    novo = new Date(agora);
  } else {
    // Adiar sempre conta a partir de agora quando a categoria já fechou —
    // senão "adiar 30 min" de um prazo vencido há uma hora não reabriria nada.
    const base = Math.max(agora, new Date(categoria.fecha_em).getTime());
    novo = new Date(base + minutos * 60 * 1000);
  }

  await supabase
    .from("bolao_categorias")
    .update({ fecha_em: novo.toISOString() })
    .eq("id", categoriaId);

  await registrar({
    usuarioId: conta.usuarioId,
    acao: minutos === "agora" ? "admin_fechou_palpites" : "admin_adiou_palpites",
    ip: await ipDoVisitante(),
    detalhes: { categoria: categoriaId, fecha_em: novo.toISOString() },
  });

  revalidatePath(`/admin/bolao/${categoriaId}`);
  revalidatePath("/admin");
}

/** Marca outro horário exato de fechamento. */
export async function mudarFechamentoDoBolao(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const quando = instanteEmBrasilia(String(dados.get("fecha_em") ?? ""));
  if (!quando) return { erro: "Data inválida." };

  const { error } = await clienteAdmin()
    .from("bolao_categorias")
    .update({ fecha_em: quando })
    .eq("id", categoriaId);

  if (error) return { erro: "Não consegui mudar o horário." };

  revalidatePath(`/admin/bolao/${categoriaId}`);
  return { aviso: "Horário atualizado." };
}

// ------------------------------------------------------------
// Chat
// ------------------------------------------------------------

/**
 * Liga, desliga e ajusta o ritmo do chat.
 *
 * O botão de desligar existe para o pior caso: se a conversa virar algo que
 * ele não consegue moderar no meio da transmissão, desligar é melhor do que
 * sair correndo atrás de mensagem por mensagem.
 */
export async function ajustarChat(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const ligado = dados.get("ligado") === "sim";
  const lento = Number(String(dados.get("modo_lento") ?? "5").trim() || 0);

  if (!Number.isFinite(lento) || lento < 0 || lento > 300) {
    return { erro: "O modo lento vai de 0 a 300 segundos." };
  }

  const { error } = await clienteAdmin()
    .from("lives")
    .update({ chat_ligado: ligado, chat_modo_lento: Math.round(lento) })
    .eq("id", liveId);

  if (error) return { erro: "Não consegui salvar." };

  revalidatePath(`/admin/live/${liveId}`);
  return {
    aviso: ligado
      ? `Chat ligado, uma mensagem a cada ${Math.round(lento)}s.`
      : "Chat desligado.",
  };
}

// ------------------------------------------------------------
// Programação
// ------------------------------------------------------------

/**
 * Acrescenta um bloco à programação do evento.
 *
 * Programação é informação, não produto: existe separada dos ingressos para
 * o dono poder vender um ingresso único e ainda assim anunciar os horários
 * de cada dia na home.
 */
export async function criarBloco(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const nome = String(dados.get("nome") ?? "").trim();
  const descricao = String(dados.get("descricao") ?? "").trim();
  const iniciaEm = instanteEmBrasilia(String(dados.get("inicia_em") ?? ""));
  const terminaEm = instanteEmBrasilia(String(dados.get("termina_em") ?? ""));

  if (nome.length < 2) return { erro: "Dê um nome ao bloco. Ex.: Dia 1 — Quinta" };
  if (!iniciaEm) return { erro: "Diga quando começa." };
  if (terminaEm && terminaEm <= iniciaEm) {
    return { erro: "O fim precisa ser depois do começo." };
  }

  const { error } = await clienteAdmin().from("blocos_programacao").insert({
    live_id: liveId,
    nome,
    descricao,
    inicia_em: iniciaEm,
    termina_em: terminaEm,
  });

  if (error) {
    console.error("[programacao] falha ao criar bloco:", error.message);
    return { erro: "Não consegui salvar o bloco." };
  }

  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
  return { aviso: `"${nome}" entrou na programação.` };
}

export async function apagarBloco(liveId: string, blocoId: string): Promise<void> {
  await exigirAdmin();

  await clienteAdmin().from("blocos_programacao").delete().eq("id", blocoId);

  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
}

// ------------------------------------------------------------
// Cortesia
// ------------------------------------------------------------

/**
 * Libera um ingresso na mão, sem pagamento.
 *
 * É a ÚNICA porta além do webhook do Mercado Pago que cria uma compra
 * aprovada, e existe porque o dono precisa dar acesso a convidado, sócio e
 * ganhador de sorteio. As travas que a tornam segura: só admin logado
 * (`exigirAdmin`), valor gravado como zero — então a cortesia nunca vira
 * faturamento — e uma linha no diário de auditoria dizendo quem liberou
 * para quem.
 */
export async function liberarCortesia(
  liveId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const email = String(dados.get("email") ?? "")
    .trim()
    .toLowerCase();
  const ingressoId = String(dados.get("ingresso") ?? "").trim();

  if (!email.includes("@")) return { erro: "Escreva o e-mail da pessoa." };
  if (!ingressoId) return { erro: "Escolha qual ingresso liberar." };

  const { data: ingresso } = await supabase
    .from("ingressos")
    .select("id, nome, live_id, so_bolao")
    .eq("id", ingressoId)
    .eq("live_id", liveId)
    .maybeSingle<{ id: string; nome: string; live_id: string; so_bolao: boolean }>();

  if (!ingresso) return { erro: "Ingresso não encontrado nesta live." };

  // O e-mail é comparado sem diferenciar maiúscula de minúscula: quem digita
  // no painel não lembra como a pessoa escreveu ao se cadastrar.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, email")
    .ilike("email", email)
    .maybeSingle<{ id: string; nome: string; email: string }>();

  if (!perfil) {
    return {
      erro:
        "Não achei conta com esse e-mail. Peça para a pessoa criar a conta " +
        "no site (e confirmar o e-mail) e tente de novo.",
    };
  }

  // Ingresso de assistir não se repete. O do bolão sim: cada um é uma
  // entrada, e liberar duas cortesias é dar dois palpites.
  if (!ingresso.so_bolao) {
    const { count } = await supabase
      .from("compras")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", perfil.id)
      .eq("ingresso_id", ingresso.id)
      .eq("status", "aprovada");

    if ((count ?? 0) > 0) {
      return { aviso: `${perfil.nome || perfil.email} já tem “${ingresso.nome}”.` };
    }
  }

  const { error } = await supabase.from("compras").insert({
    usuario_id: perfil.id,
    live_id: liveId,
    ingresso_id: ingresso.id,
    status: "aprovada",
    valor_centavos: 0,
  });

  if (error) {
    console.error("[cortesia] falha ao liberar:", error.message);
    return { erro: "Não consegui liberar o acesso." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: "admin_liberou_cortesia",
    ip: await ipDoVisitante(),
    detalhes: {
      alvo: perfil.id,
      email: perfil.email,
      ingresso_id: ingresso.id,
      ingresso: ingresso.nome,
    },
  });

  revalidatePath(`/admin/live/${liveId}`);
  return {
    aviso: `Acesso liberado para ${perfil.nome || perfil.email} — “${ingresso.nome}”.`,
  };
}


/**
 * Pergunta ao Mercado Pago se uma compra foi paga, e libera se foi.
 *
 * É a rede de segurança do dia da live. O caminho normal é o webhook: o
 * Mercado Pago avisa e o acesso sai sozinho. Mas o aviso pode não chegar, ou
 * chegar de um jeito que não dá para conferir — foi o que aconteceu no
 * ambiente de teste em 01/09/2026, e num dia de venda seria um comprador
 * pago esperando na porta.
 *
 * Aqui a direção se inverte: quem pergunta somos nós, com o nosso access
 * token. Por isso não há assinatura a validar — não existe ninguém de fora
 * falando, a resposta vem direto do Mercado Pago. Continua valendo a
 * conferência de valor, e continua sendo só para admin logado.
 */
export async function conferirPagamento(
  compraId: string,
  _anterior: EstadoFormulario,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("id", compraId)
    .maybeSingle<Compra>();

  if (!compra) return { erro: "Compra não encontrada." };

  const pagamento = await buscarPagamentoDaCompra(compraId);

  if (!pagamento) {
    await registrar({
      usuarioId: conta.usuarioId,
      liveId: compra.live_id,
      acao: "admin_conferiu_pagamento_sem_achar",
      ip: await ipDoVisitante(),
      detalhes: { compraId },
    });
    revalidatePath(`/admin/live/${compra.live_id}`);
    return {
      erro:
        "O Mercado Pago não achou pagamento para esta compra. Ou ela nunca " +
        "foi paga, ou foi paga com outras credenciais das que estão no site agora.",
    };
  }

  let novoStatus = statusDaCompra(pagamento.status);

  // A mesma trava do webhook: pagou menos do que foi cobrado, não libera.
  if (
    novoStatus === "aprovada" &&
    typeof pagamento.valorCentavos === "number" &&
    pagamento.valorCentavos < compra.valor_centavos - 1
  ) {
    novoStatus = "pendente";
  }

  await supabase
    .from("compras")
    .update({
      status: novoStatus,
      mp_payment_id: pagamento.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", compra.id);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: compra.live_id,
    acao: "admin_conferiu_pagamento",
    ip: await ipDoVisitante(),
    detalhes: {
      compraId,
      comprador: compra.usuario_id,
      idPagamento: pagamento.id,
      statusMercadoPago: pagamento.status,
      virou: novoStatus,
    },
  });

  revalidatePath(`/admin/live/${compra.live_id}`);

  if (novoStatus === "aprovada") return { aviso: "Pago. Acesso liberado." };
  return {
    aviso: `O Mercado Pago diz "${pagamento.status}". Ainda não dá para liberar.`,
  };
}


/**
 * Apaga uma tentativa de compra que nunca foi paga.
 *
 * Serve para limpar a lista: cobrança começada e abandonada, teste, compra
 * que ficou pendente para sempre. Recusa compra PAGA de propósito — o
 * registro de quem pagou tem de sobreviver, e para tirar o acesso de quem
 * pagou existe `revogarAcesso`, que mantém a linha.
 */
export async function apagarTentativaDeCompra(
  compraId: string,
  _anterior: EstadoFormulario,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("id", compraId)
    .maybeSingle<Compra>();

  if (!compra) return { erro: "Compra não encontrada." };

  if (compra.status === "aprovada") {
    return {
      erro: "Esta compra está paga. Para tirar o acesso use “Revogar acesso” — apagar sumiria com o registro de quem pagou.",
    };
  }

  await supabase.from("compras").delete().eq("id", compra.id);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: compra.live_id,
    acao: "admin_apagou_tentativa_de_compra",
    ip: await ipDoVisitante(),
    detalhes: {
      compraId,
      comprador: compra.usuario_id,
      status: compra.status,
      valorCentavos: compra.valor_centavos,
    },
  });

  revalidatePath(`/admin/live/${compra.live_id}`);
  return { aviso: "Tentativa apagada." };
}

/**
 * Tira o acesso de quem já tem.
 *
 * Duas situações, tratadas diferente de propósito:
 *
 * - **Cortesia** (valor zero): a linha é apagada. Não houve pagamento, então
 *   não há registro financeiro a preservar — e quem liberou continua no
 *   diário de auditoria.
 * - **Compra paga**: a linha FICA, marcada como reembolsada. Some o acesso,
 *   permanece a prova de que a pessoa pagou. Apagar aqui seria destruir o
 *   registro que protege os dois lados numa discussão.
 *
 * Nos dois casos a sessão ativa cai junto: sem isso, quem estivesse com o
 * player aberto continuaria assistindo até o próximo heartbeat.
 *
 * Devolver o dinheiro é passo à parte, no painel do Mercado Pago. Este botão
 * não movimenta dinheiro nenhum.
 */
export async function revogarAcesso(
  compraId: string,
  _anterior: EstadoFormulario,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("id", compraId)
    .maybeSingle<Compra>();

  if (!compra) return { erro: "Compra não encontrada." };
  if (compra.status !== "aprovada") {
    return { erro: "Esta compra não está liberada — não há acesso a revogar." };
  }

  const eraCortesia = compra.valor_centavos === 0;

  if (eraCortesia) {
    await supabase.from("compras").delete().eq("id", compra.id);
  } else {
    await supabase
      .from("compras")
      .update({ status: "reembolsada", atualizado_em: new Date().toISOString() })
      .eq("id", compra.id);
  }

  await supabase.from("sessoes_ativas").delete().eq("usuario_id", compra.usuario_id);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: compra.live_id,
    acao: eraCortesia ? "admin_revogou_cortesia" : "admin_revogou_compra_paga",
    ip: await ipDoVisitante(),
    detalhes: { compraId, comprador: compra.usuario_id, valorCentavos: compra.valor_centavos },
  });

  revalidatePath(`/admin/live/${compra.live_id}`);
  return {
    aviso: eraCortesia
      ? "Cortesia removida."
      : "Acesso revogado. A compra fica registrada como reembolsada — devolver o dinheiro é no painel do Mercado Pago.",
  };
}
