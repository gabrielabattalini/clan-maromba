# Validação de segurança — 14/08/2026

Auditoria do site inteiro (não só das mudanças do dia), feita a pedido do
dono. Escrita para ser lida por quem não programa.

**Resumo:** as travas principais estão de pé e foram testadas no site no ar.
Encontrei e corrigi 6 problemas. Sobraram 4 pendências que **só você pode
resolver** — e uma delas é séria, está logo abaixo.

---

## As três perguntas que você fez

### 1. "Alguém consegue entrar no painel de admin?"

**Pelo site, não.** Testei no ar, agora:

| Tentativa | Resultado |
|---|---|
| Abrir `/admin` sem estar logado | Empurrado para o login |
| Abrir `/admin` logado como comprador comum | Empurrado para a home |
| Abrir `/status` sem ser admin | "Página restrita" |
| Chamar as ações do painel por fora | Todas as 7 exigem admin antes de qualquer coisa |

Ser administrador depende de uma coluna no banco (`perfis.admin`) que
**nenhum usuário consegue escrever** — a trava do Supabase (RLS) só permite
leitura do próprio perfil, e nada de escrita. Só dá para virar admin rodando
SQL no painel do Supabase, como você fez.

**Mas há um caminho que não passa pelo site** — veja a pendência nº 1.

### 2. "Alguém consegue assistir à live sem pagar?"

**Não.** Para o vídeo tocar, o site exige, na mesma requisição: estar logado,
não estar banido, ser o aparelho autorizado no momento, ter compra
**aprovada** daquela live específica, e a live estar no ar. Falhando qualquer
uma, não sai token e não sai vídeo.

O endereço do vídeo não é fixo: é um token assinado que **vale 5 minutos**.
Copiar o link e mandar para alguém não funciona — quando a pessoa abrir, já
venceu.

**O limite honesto:** quem comprou e quiser dividir o acesso ao vivo, dentro
daqueles 5 minutos, consegue. Contra isso jogam três coisas ao mesmo tempo: o
token curto, a sessão única (o segundo aparelho derruba o primeiro) e a marca
d'água com nome e e-mail de quem está assistindo. O objetivo declarado é
**rastrear vazamento**, não torná-lo impossível — quem filmar a tela com o
celular leva a marca junto, e é assim que se descobre quem foi.

### 3. "Alguém consegue trocar a chave do Mercado Pago e desviar os pagamentos?"

**Pelo site, não existe esse caminho.** A chave do Mercado Pago só é lida das
variáveis de ambiente da Vercel. Não há nenhuma tela, formulário ou rota que
escreva nela — nem para o admin. O valor da cobrança também sai sempre do
banco, no servidor, nunca do que o navegador manda.

Reforcei mais uma trava: o webhook agora **confere se o valor pago bate com o
preço da live** antes de liberar o acesso. Se vier menos, não libera e fica
registrado.

**Mas quem tiver o token de API da Vercel troca essa chave em 10 segundos** —
é exatamente o cenário que você descreveu. Veja a pendência nº 1.

---

## ⚠️ O que depende de você

### 1. Trocar as duas chaves que passaram pelo chat — **prioridade máxima**

Duas chaves foram coladas na nossa conversa e ficaram gravadas no histórico:

| Chave | O que ela permite a quem tiver |
|---|---|
| **Token de API da Vercel** | Trocar o `MP_ACCESS_TOKEN` e **desviar todos os pagamentos** para outra conta. Também ler e alterar qualquer outra variável. |
| **Chave secreta do Supabase** (`sb_secret_…`) | Ignorar todas as travas do banco: ler o e-mail de todos os compradores, se tornar admin, apagar tudo. |

Não é uma falha do código — o código está certo. É que essas duas chaves
valem mais do que qualquer trava do site, e a regra vale para chave: uma vez
que saiu, saiu.

**Como trocar (5 minutos, sem quebrar nada):**

1. **Vercel:** <https://vercel.com/account/tokens> → três pontinhos no token
   → **Delete**. Crie outro só quando precisar.
2. **Supabase:** painel do projeto → **Project Settings** → **API Keys** →
   na linha da *Secret key*, **Rotate** (ou crie uma nova e apague a antiga).
   Copie a nova e cole na Vercel em `SUPABASE_SERVICE_ROLE_KEY` →
   **Redeploy**.

Enquanto isso não for feito, considere que o site tem uma porta destrancada
que não está no código.

### 2. Ligar a verificação em duas etapas nas cinco contas

Vercel, Supabase, Mercado Pago, Cloudflare e GitHub. Se alguém entrar em
qualquer uma dessas, o site cai junto — e nenhuma trava de código protege
contra uma senha de painel roubada. É o item de melhor retorno depois do nº 1.

### 3. Senha forte e exclusiva na sua conta de admin

Sua conta de comprador é a mesma que abre o painel. O site exige no mínimo 8
caracteres e trava depois de 8 tentativas erradas em 10 minutos, mas a defesa
real é a senha ser longa e não repetida de outro lugar. Use o gerador do seu
gerenciador de senhas.

### 4. Antes de vender de verdade: sair do plano Hobby da Vercel

Já anotado no guia. O plano Hobby proíbe uso comercial — não é segurança, é
risco de o site ser derrubado justamente no dia da primeira live paga.

---

## O que eu corrigi nesta auditoria

| # | O que era | Gravidade | Situação |
|---|---|---|---|
| 1 | **Redirecionamento aberto:** um link como `/entrar?voltar=/\site-falso.com` levaria a pessoa para fora do site logo depois de digitar a senha — golpe de phishing usando a credibilidade do seu domínio. A checagem antiga barrava `//` mas não a barra invertida, que o navegador converte em barra. | Média | Corrigido, com 9 testes automáticos |
| 2 | **Sem trava de compilação na chave-mestra:** o arquivo que usa a chave secreta do banco só tinha um comentário avisando "não importe no navegador". Comentário depende de alguém ler. | Média | Agora tem `server-only`: se alguém importar errado, **o build quebra** em vez de publicar a chave |
| 3 | **Site podia ser posto dentro de um iframe** de outra página, técnica usada para enganar o visitante a clicar em algo sem perceber. | Média | Bloqueado (`frame-ancestors 'none'` + `X-Frame-Options`) |
| 4 | **Páginas do painel podiam ficar em cache** — e elas mostram a chave de transmissão do OBS e a chave de assinatura do vídeo. | Média | `no-store` em tudo sob `/admin` |
| 5 | **Valor do pagamento não era conferido** contra o preço da live antes de liberar acesso. | Baixa | Agora confere, e registra se não bater |
| 6 | **Título de live em rascunho vazava** pela função que monta o título da aba, que roda fora da proteção da página. | Baixa | Rascunho devolve título genérico |

Também: removi um arquivo de código morto que era o único caminho pelo qual
credenciais do banco poderiam algum dia chegar ao navegador; desliguei o
cabeçalho `X-Powered-By`, que só anuncia a versão em uso; e adicionei
`robots.txt` para manter painel, player e área da conta fora do Google.

---

## O que testei e passou

**Prova de que nenhum segredo chega ao navegador.** Compilei o site com
valores-isca no lugar das cinco chaves secretas e procurei por eles em todos
os arquivos que o navegador baixa. **Zero ocorrências.** Conferi também a
estrutura: dos 7 componentes que rodam no navegador, nenhum importa
configuração nem cliente de banco — só React, links, tipos (que somem na
compilação) e ações de servidor (que viram chamada remota, não código).

**A trava do webhook do Mercado Pago.** É ela que separa "pagou" de "não
pagou": sem ela, qualquer pessoa chamaria nosso endereço fingindo um
pagamento aprovado. Tem 10 testes automáticos rodando a cada alteração, e
eles cobrem os casos que precisam ser recusados — assinatura de outro
segredo, horário adulterado, assinatura válida reaproveitada para outro
pagamento, e assinatura de tamanho diferente.

**Reenvio de webhook antigo não engana o site**, porque nós não confiamos no
que o aviso diz: ao receber, o servidor vai à API do Mercado Pago perguntar o
status atual daquele pagamento.

**Injeção de código nas telas.** Nenhum lugar do site injeta HTML sem escape.
O React escapa tudo por padrão e não há exceção aberta em nenhum arquivo.

**Injeção de SQL.** Todas as consultas passam pela biblioteca oficial do
Supabase com parâmetros separados. Não há SQL montado com texto colado.

**Isolamento no banco.** RLS ligada nas 7 tabelas. Cada pessoa só enxerga o
próprio perfil, as próprias compras e a própria sessão. A tabela com a chave
de transmissão do OBS (`lives_privado`) **não tem nenhuma permissão de
leitura** — nem para usuário logado. Só o servidor chega nela.

**Limite de tentativas** em login, cadastro, compra e emissão de token.

---

## Decisões que ficam registradas

**Por que não há uma trava por IP no vídeo.** Daria para amarrar o token ao
IP de quem pediu, o que fecharia de vez o compartilhamento dentro dos 5
minutos. Não fiz porque no celular o IP muda sozinho (troca de antena, sai do
Wi-Fi) e o vídeo cortaria no meio para quem pagou certo. Fica como opção para
a Fase 2, se algum dia o vazamento virar problema real.

**Por que o limite de tentativas libera em caso de falha do banco.** Se o
contador não puder ser lido, a ação passa em vez de travar. Um comprador
legítimo não fica preso do lado de fora por causa de instabilidade — o preço
é que, durante uma falha do banco, a proteção contra tentativa em massa fica
suspensa.

**Por que a marca d'água não é inviolável.** Ela é HTML sobre o vídeo. Quem
entende do assunto remove pelo navegador. O player percebe e pausa, mas isso
também é contornável. Ela existe para **identificar quem vazou**, não para
impedir — e para isso funciona, inclusive contra gravação de tela.
