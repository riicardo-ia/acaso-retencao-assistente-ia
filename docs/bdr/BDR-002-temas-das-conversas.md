# BDR-002 · Lista de temas das conversas

**Decidido por:** Ricardo · **Status:** aprovado
**Evidência:** `docs/analise/05-temas.md` · **Código:** `analise/classificar.py`

## Contexto

O PDF pede o tema da 1ª experiência como variável. Não há tema na base; ele precisa ser atribuído a partir do texto, e a lista de temas é uma decisão de negócio: define como o cliente vai enxergar o uso do assistente.

## Opções consideradas

| Opção | Por que não / por que sim |
|---|---|
| Deixar o LLM criar temas livremente | Categorias mudam a cada execução; impossível acompanhar no tempo |
| Classificar pela 1ª mensagem | A 1ª mensagem costuma ser só "oi" ou um teste; o assunto real vem depois |
| **Lista fechada, descoberta nos dados e revisada manualmente, aplicada à conversa inteira** | Escolhida |

## Decisão

11 temas: estudo e trabalho acadêmico · programação e tecnologia · reescrita, resumo e tradução · marketing e conteúdo profissional · ficção, roleplay e criação · conhecimento geral e curiosidades · vida prática e conselhos · **pedido de imagem, vídeo ou áudio** · **tentativa de burlar regras** · **só cumprimenta ou testa o assistente** · outro.

- Os três em negrito ficam separados mesmo sendo pequenos: medem onde o assistente falha ou recusa, e o PDF pede "onde ele falha".
- Vale o **pedido principal** da conversa; "só cumprimenta ou testa" é só para conversas que apenas testam.
- Temas com menos de 30 pessoas na 1ª conversa entram como "outro" no modelo.

## Consequências

- Os achados 1 e 3 de `docs/DOCUMENTO.md` dependem desta lista.
- Trocar a lista exige reclassificar e revalidar (`analise/validar_temas.py`).
