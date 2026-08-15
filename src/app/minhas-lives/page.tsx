import { permanentRedirect } from "next/navigation";

/**
 * "Minhas lives" virou "Loja".
 *
 * O redirecionamento fica: o endereço antigo já foi mandado por e-mail de
 * recuperação de senha e pode estar salvo no navegador de quem comprou.
 */
export default function MinhasLives() {
  permanentRedirect("/loja");
}
